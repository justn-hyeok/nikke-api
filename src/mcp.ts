import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

// MCP (Model Context Protocol) face of the REST API, served at /mcp so
// ChatGPT/Claude connectors can use the data as tools. Every tool is a thin
// wrapper over an existing GET route — the handler is handed a fetcher
// (app.request) instead of importing app.ts, so there is one implementation.
// Stateless: a fresh server per request, which is what serverless needs.

type Fetcher = (path: string) => Promise<Response>;

// LLM context is the scarce resource — big payloads (a nikke detail is ~130KB,
// the full stage list ~600KB) are shrunk to this many characters
const MAX_CHARS = 60_000;

const INSTRUCTIONS = `Unofficial NIKKE (GODDESS OF VICTORY: NIKKE) game data. Data © SHIFT UP / Level Infinite.
- Character names exist in ko/en/ja/zh-TW and searches match any of them; responses default to Korean (lang=ko).
- Story scene scripts are Korean only.
- Filters take English enum values; Korean terms map as noted in each parameter (e.g. 철갑 = Iron).
- Lists are paged with limit/offset. Oversized responses come back with a "truncated" object telling you how to fetch the rest.
- get_user_* tools query the live game API through a shared account: they are slow and rate limited, so call them only when the user gives a BlablaLink share link.`;

const LANG = z
  .enum(["ko", "en", "ja", "zh-TW"])
  .default("ko")
  .describe("Language to flatten localized names/text into (default ko)");
const LIMIT = z.number().int().min(1).max(100).default(20);
const OFFSET = z.number().int().min(0).default(0);
const BLABLAID = z
  .string()
  .min(1)
  .describe("BlablaLink share id (base64 openid) or the whole share URL (https://www.blablalink.com/user?openid=...)");

// filter values are English and matched case-insensitively by the routes;
// enums keep models from guessing, the Korean names map user wording
const FILTERS = {
  element: z
    .enum(["Fire", "Water", "Wind", "Electronic", "Iron"])
    .optional()
    .describe("Element: Fire=작열, Water=수냉, Wind=풍압, Electronic=전격, Iron=철갑"),
  class: z
    .enum(["Attacker", "Defender", "Supporter"])
    .optional()
    .describe("Class: Attacker=화력형, Defender=방어형, Supporter=지원형"),
  burst: z.enum(["I", "II", "III", "All"]).optional().describe("Burst stage (All = usable at any stage)"),
  corporation: z
    .enum(["ELYSION", "MISSILIS", "TETRA", "PILGRIM", "ABNORMAL"])
    .optional()
    .describe("Manufacturer: 엘리시온 / 미실리스 / 테트라 / 필그림 / 어브노멀"),
  weapon: z
    .enum(["AR", "SMG", "SG", "SR", "RL", "MG"])
    .optional()
    .describe("Weapon: AR=돌격소총, SMG=기관단총, SG=샷건, SR=저격소총, RL=런처, MG=기관총"),
  rarity: z.enum(["SSR", "SR", "R"]).optional(),
};

// voices (~80KB) and statsPerLevel (~30KB) dominate a detail — opt-in only
const NIKKE_DEFAULT_FIELDS = [
  "id", "resourceId", "name", "rarity", "class", "burst", "corporation", "element", "weapon",
  "details.skills", "details.backstory", "details.squad", "details.cv", "details.combat",
  "details.attractiveScenarios",
];
const NIKKE_EXTRA = {
  statsPerLevel: "details.statsPerLevel",
  voices: "details.voices",
  teammateList: "details.teammateList",
  costumes: "costumes",
  images: "images",
} as const;

// routes api_get may reach — the rest have dedicated tools, and /api/user
// (live upstream calls) and /api/tables (multi-MB raw dumps) stay closed
const API_GET_ALLOWED = /^\/api\/(stages|costumes|equips|avatars|cubes|meta|cdn)(\/|\?|$)/;

const READ_ONLY = { readOnlyHint: true, idempotentHint: true, openWorldHint: false } as const;
// live account data — upstream game API calls through the server's
// configured BlablaLink session, so these touch the outside world
const LIVE = { readOnlyHint: true, idempotentHint: true, openWorldHint: true } as const;

// a burst guard for the live user tools: per instance, so it only stops a
// single runaway tool loop from draining the shared account's rate limit
const USER_CALLS_PER_MINUTE = 30;
const userCalls: number[] = [];
const userRateLimited = () => {
  const now = Date.now();
  while (userCalls.length && now - userCalls[0] > 60_000) userCalls.shift();
  if (userCalls.length >= USER_CALLS_PER_MINUTE) return Math.ceil((60_000 - (now - userCalls[0])) / 1000);
  userCalls.push(now);
  return 0;
};

const qs = (params: Record<string, string | number | undefined>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
};

const enc = encodeURIComponent;

const text = (t: string, isError = false) => ({
  content: [{ type: "text" as const, text: t }],
  ...(isError ? { isError: true } : {}),
});

/**
 * Fit a JSON body into MAX_CHARS without breaking it: the largest top-level
 * array is cut from the end and a `truncated` note says how to page on.
 * Bodies with no array to cut become an error asking for a narrower query.
 */
export function fitJson(body: string, max = MAX_CHARS): { text: string; isError?: boolean } {
  if (body.length <= max) return { text: body };
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    return { text: body.slice(0, max) };
  }
  const obj = data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
  const key = obj
    ? Object.keys(obj)
        .filter((k) => Array.isArray(obj[k]))
        .sort((a, b) => JSON.stringify(obj[b]).length - JSON.stringify(obj[a]).length)[0]
    : undefined;
  if (!obj || !key) {
    return {
      text: JSON.stringify({
        error: `response too large (${body.length} chars) — request fewer fields or a narrower query`,
      }),
      isError: true,
    };
  }
  const items = obj[key] as unknown[];
  const offset = typeof obj.offset === "number" ? obj.offset : 0;
  const render = (n: number) =>
    JSON.stringify({
      ...obj,
      [key]: items.slice(0, n),
      truncated: {
        field: key,
        returned: n,
        omitted: items.length - n,
        ...(typeof obj.count === "number" ? { nextOffset: offset + n } : {}),
        hint: "response was too large — page with offset/limit or request fewer fields",
      },
    });
  // largest item count that still fits
  let lo = 0;
  let hi = items.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (render(mid).length <= max) lo = mid;
    else hi = mid - 1;
  }
  return { text: render(lo) };
}

async function call(api: Fetcher, tool: string, path: string, shape?: (data: any) => unknown) {
  const started = Date.now();
  const res = await api(path);
  let body = await res.text();
  if (res.ok && shape) body = JSON.stringify(shape(JSON.parse(body)));
  const out = fitJson(body);
  // one structured line per tool call — Vercel logs otherwise only show POST /mcp
  console.log(
    JSON.stringify({ mcp: tool, status: res.status, ms: Date.now() - started, chars: out.text.length }),
  );
  return text(out.text, !res.ok || out.isError);
}

// scene lines carry a voice mp3 and an icon webp URL each — drop them unless
// asked, the dialogue is what a model reads
const shapeScene = (includeMedia: boolean) => (d: any) =>
  includeMedia || !Array.isArray(d?.lines)
    ? d
    : { ...d, lines: d.lines.map((l: any) => ({ speaker: l.speakerName ?? l.speaker, text: l.text })) };

export function buildServer(api: Fetcher, version: string) {
  const server = new McpServer({ name: "nikke-api", version }, { instructions: INSTRUCTIONS });

  const userTool = <T>(name: string, run: (a: T) => Promise<ReturnType<typeof text>>) => async (a: T) => {
    const wait = userRateLimited();
    if (wait) {
      console.log(JSON.stringify({ mcp: name, status: 429 }));
      return text(JSON.stringify({ error: `rate limited — retry in ${wait}s` }), true);
    }
    return run(a);
  };

  server.registerTool(
    "search_nikkes",
    {
      title: "Search NIKKE characters",
      description:
        "List/search NIKKE characters by name (any language) and filters. Returns id, name, rarity, class, burst, element, weapon, corporation. Use get_nikke for skills/stats.",
      inputSchema: z.object({
        q: z.string().optional().describe("Name substring, any language"),
        ...FILTERS,
        limit: LIMIT,
        offset: OFFSET,
        lang: LANG,
      }),
      annotations: READ_ONLY,
    },
    async (a) =>
      call(
        api,
        "search_nikkes",
        `/api/nikkes${qs({
          q: a.q,
          element: a.element,
          class: a.class,
          burst: a.burst,
          corporation: a.corporation,
          weapon: a.weapon,
          rarity: a.rarity,
          limit: a.limit,
          offset: a.offset,
          lang: a.lang,
          fields: "id,resourceId,name,rarity,class,burst,corporation,element,weapon",
        })}`,
      ),
  );

  server.registerTool(
    "get_nikke",
    {
      title: "Get NIKKE character detail",
      description:
        "Character detail: profile, skills (rendered at Lv10), backstory, squad, CV and affection (호감도) scene ids. Add more with include. If the name matches several characters, a {count, characters} list comes back instead — call again with one of their ids.",
      inputSchema: z.object({
        nameOrId: z.string().min(1).describe("Character name (partial, any language), id or resourceId"),
        include: z
          .array(z.enum(Object.keys(NIKKE_EXTRA) as [keyof typeof NIKKE_EXTRA]))
          .optional()
          .describe("Extra sections added to the default: statsPerLevel (~30KB), voices (~80KB, voice lines), teammateList, costumes, images"),
        lang: LANG,
      }),
      annotations: READ_ONLY,
    },
    async (a) => {
      const fields = [...NIKKE_DEFAULT_FIELDS, ...(a.include ?? []).map((k) => NIKKE_EXTRA[k])].join(",");
      return call(api, "get_nikke", `/api/nikkes/${enc(a.nameOrId)}${qs({ fields, lang: a.lang })}`);
    },
  );

  server.registerTool(
    "search_scenes",
    {
      title: "Search story scenes",
      description:
        "List story scene scripts (Korean): main story, events, sudden (돌발) and affection scenes. Use get_scene to read the dialogue.",
      inputSchema: z.object({
        q: z.string().optional().describe("Scene name or groupId substring"),
        category: z.enum(["main", "event", "sudden", "attractive"]).optional(),
        nikke: z.string().optional().describe("Affection scenes of this character (name or id)"),
        limit: LIMIT,
        offset: OFFSET,
      }),
      annotations: READ_ONLY,
    },
    async (a) =>
      call(
        api,
        "search_scenes",
        `/api/scenes${qs({ q: a.q, category: a.category, nikke: a.nikke, limit: a.limit, offset: a.offset })}`,
      ),
  );

  server.registerTool(
    "get_scene",
    {
      title: "Read a scene script",
      description:
        "Dialogue of one scene as {speaker, text} lines (Korean), by groupId from search_scenes or get_event.",
      inputSchema: z.object({
        groupId: z.string().min(1),
        includeMedia: z
          .boolean()
          .default(false)
          .describe("Also return each line's voice and speaker icon URLs (much larger)"),
      }),
      annotations: READ_ONLY,
    },
    async (a) => call(api, "get_scene", `/api/scenes/${enc(a.groupId)}`, shapeScene(a.includeMedia)),
  );

  server.registerTool(
    "list_events",
    {
      title: "List story events",
      description:
        "Story events with title and episode count (get_event lists the scenes). q matches the event id or title, ignoring punctuation.",
      inputSchema: z.object({
        q: z.string().optional(),
        limit: LIMIT,
        offset: OFFSET,
      }),
      annotations: READ_ONLY,
    },
    async (a) =>
      call(
        api,
        "list_events",
        `/api/events${qs({ q: a.q, limit: a.limit, offset: a.offset, fields: "id,title,episodes,totalLines" })}`,
      ),
  );

  server.registerTool(
    "get_event",
    {
      title: "Get story event",
      description: "One story event with its scenes in story order (groupId, name, line count).",
      inputSchema: z.object({ id: z.string().min(1).describe("Event id, e.g. event_claymore") }),
      annotations: READ_ONLY,
    },
    async (a) => call(api, "get_event", `/api/events/${enc(a.id)}`),
  );

  server.registerTool(
    "search_favorites",
    {
      title: "Search favorite items (소장품)",
      description: "Favorite items (소장품) list. Use get_favorite for per-level stats and skills.",
      inputSchema: z.object({
        q: z.string().optional(),
        rare: z.enum(["SSR", "SR", "R"]).optional(),
        limit: LIMIT,
        offset: OFFSET,
        lang: LANG,
      }),
      annotations: READ_ONLY,
    },
    async (a) =>
      call(
        api,
        "search_favorites",
        `/api/favorites${qs({ q: a.q, rare: a.rare, limit: a.limit, offset: a.offset, lang: a.lang })}`,
      ),
  );

  server.registerTool(
    "get_favorite",
    {
      title: "Get favorite item detail",
      description: "Favorite item (소장품) detail: stats per level, collection and exclusive skills.",
      inputSchema: z.object({ id: z.string().min(1), lang: LANG }),
      annotations: READ_ONLY,
    },
    async (a) => call(api, "get_favorite", `/api/favorites/${enc(a.id)}${qs({ lang: a.lang })}`),
  );

  server.registerTool(
    "api_get",
    {
      title: "Call another read endpoint",
      description:
        "GET the endpoints without a dedicated tool: /api/stages (?chapter=&mode=), /api/stages/:id, /api/costumes (?nikke=&grade=), /api/costumes/:id, /api/equips, /api/equips/options, /api/cubes, /api/avatars, /api/meta/filters. Add lang=ko to flatten names. See /openapi.json for parameters.",
      inputSchema: z.object({
        path: z.string().startsWith("/api/").describe("Path with query string, e.g. /api/stages?chapter=1&lang=ko"),
      }),
      annotations: READ_ONLY,
    },
    async (a) => {
      if (a.path.includes("..") || !API_GET_ALLOWED.test(a.path)) {
        return text(
          JSON.stringify({
            error:
              "path not allowed — api_get serves stages, costumes, equips, cubes, avatars, meta and cdn; use the dedicated tools for the rest",
          }),
          true,
        );
      }
      return call(api, "api_get", a.path);
    },
  );

  server.registerTool(
    "get_user_profile",
    {
      title: "Get player profile",
      description:
        "A player's public profile (nickname, level, team combat, campaign progress, towers) from their BlablaLink share link. Live and rate limited.",
      inputSchema: z.object({ blablaid: BLABLAID, lang: LANG }),
      annotations: LIVE,
    },
    userTool("get_user_profile", (a: { blablaid: string; lang: string }) =>
      call(api, "get_user_profile", `/api/user${qs({ blablaid: a.blablaid, lang: a.lang })}`),
    ),
  );

  server.registerTool(
    "get_user_nikkes",
    {
      title: "List a player's NIKKEs",
      description:
        "Characters a player owns with their level. Filters work like search_nikkes; use get_user_nikke for one character's full build. Live and rate limited.",
      inputSchema: z.object({
        blablaid: BLABLAID,
        name: z.string().optional().describe("Name substring, any language"),
        ...FILTERS,
        lang: LANG,
      }),
      annotations: LIVE,
    },
    userTool("get_user_nikkes", (a: Record<string, string | undefined>) =>
      call(
        api,
        "get_user_nikkes",
        `/api/user/nikke${qs({
          blablaid: a.blablaid,
          name: a.name,
          element: a.element,
          class: a.class,
          burst: a.burst,
          corporation: a.corporation,
          weapon: a.weapon,
          rarity: a.rarity,
          lang: a.lang,
        })}`,
      ),
    ),
  );

  server.registerTool(
    "get_user_nikke",
    {
      title: "Get one of a player's NIKKEs",
      description:
        "Build detail of one owned character: skill levels, equipment, cube, favorite item. If the name matches several owned characters, a list comes back — call again with an id. Live and rate limited.",
      inputSchema: z.object({
        blablaid: BLABLAID,
        nameOrId: z.string().min(1).describe("Character name (partial, any language) or id"),
        lang: LANG,
      }),
      annotations: LIVE,
    },
    userTool("get_user_nikke", (a: { blablaid: string; nameOrId: string; lang: string }) =>
      call(api, "get_user_nikke", `/api/user/nikke/${enc(a.nameOrId)}${qs({ blablaid: a.blablaid, lang: a.lang })}`),
    ),
  );

  return server;
}

export const createNikkeMcp = (api: Fetcher, version: string) =>
  createMcpHandler(() => buildServer(api, version), {
    onerror: (e) => console.error(JSON.stringify({ mcp: "error", message: e.message })),
  });
