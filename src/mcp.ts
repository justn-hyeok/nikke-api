import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

// MCP (Model Context Protocol) face of the REST API, served at /mcp so
// ChatGPT/Claude connectors can use the data as tools. Every tool is a thin
// wrapper over an existing GET route — the handler is handed a fetcher
// (app.request) instead of importing app.ts, so there is one implementation.
// Stateless: a fresh server per request, which is what serverless needs.

type Fetcher = (path: string) => Promise<Response>;

// LLM context is the scarce resource — big payloads (a nikke detail is ~90KB,
// the full stage list ~600KB) are cut with a hint to narrow the query
const MAX_CHARS = 60_000;

const LANG = z
  .enum(["ko", "en", "ja", "zh-TW"])
  .default("ko")
  .describe("Language to flatten localized names/text into (default ko)");
const LIMIT = z.number().int().min(1).max(100).default(20);
const OFFSET = z.number().int().min(0).default(0);
const FIELDS = z
  .string()
  .optional()
  .describe("Comma-separated dot paths to keep, e.g. 'id,name,details.skills' — use to shrink large responses");
const BLABLAID = z
  .string()
  .min(1)
  .describe("BlablaLink share id (base64 openid) or the whole share URL (https://www.blablalink.com/user?openid=...)");

// voices (~80KB) and statsPerLevel (~30KB) dominate a detail — opt-in only
const NIKKE_DEFAULT_FIELDS = [
  "id", "resourceId", "name", "rarity", "class", "burst", "corporation", "element", "weapon",
  "details.skills", "details.backstory", "details.squad", "details.cv", "details.combat",
  "details.attractiveScenarios",
].join(",");

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

const qs = (params: Record<string, string | number | undefined>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
};

const enc = encodeURIComponent;

async function call(api: Fetcher, path: string) {
  const res = await api(path);
  let text = await res.text();
  if (text.length > MAX_CHARS) {
    text =
      text.slice(0, MAX_CHARS) +
      `\n…[truncated ${text.length - MAX_CHARS} chars — narrow the query with fields/limit/offset]`;
  }
  return {
    content: [{ type: "text" as const, text }],
    ...(res.ok ? {} : { isError: true }),
  };
}

export function buildServer(api: Fetcher, version: string) {
  const server = new McpServer({ name: "nikke-api", version });

  server.registerTool(
    "search_nikkes",
    {
      title: "Search NIKKE characters",
      description:
        "List/search NIKKE characters by name (any language) and filters. Returns id, name, rarity, class, burst, element, weapon, corporation. Use get_nikke for skills/stats.",
      inputSchema: z.object({
        q: z.string().optional().describe("Name substring, any language"),
        element: z.string().optional().describe("Fire / Water / Wind / Electronic / Iron"),
        class: z.string().optional().describe("Attacker / Defender / Supporter"),
        burst: z.string().optional().describe("I / II / III / All"),
        corporation: z.string().optional().describe("ELYSION / MISSILIS / TETRA / PILGRIM / ABNORMAL"),
        weapon: z.string().optional().describe("AR / SMG / SG / SR / RL / MG"),
        rarity: z.string().optional().describe("SSR / SR / R"),
        limit: LIMIT,
        offset: OFFSET,
        lang: LANG,
      }),
      annotations: READ_ONLY,
    },
    async (a) =>
      call(
        api,
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
        "Character detail. By default returns profile, skills (rendered at Lv10), backstory, squad, CV and affection (호감도) scene ids. Pass fields for the rest, e.g. 'details.statsPerLevel', 'details.voices', 'costumes', 'details.teammateList'.",
      inputSchema: z.object({
        nameOrId: z.string().min(1).describe("Character name (partial, any language), id or resourceId"),
        fields: FIELDS,
        lang: LANG,
      }),
      annotations: READ_ONLY,
    },
    async (a) =>
      call(api, `/api/nikkes/${enc(a.nameOrId)}${qs({ fields: a.fields ?? NIKKE_DEFAULT_FIELDS, lang: a.lang })}`),
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
      call(api, `/api/scenes${qs({ q: a.q, category: a.category, nikke: a.nikke, limit: a.limit, offset: a.offset })}`),
  );

  server.registerTool(
    "get_scene",
    {
      title: "Read a scene script",
      description: "Dialogue lines of one scene (speaker, text, voice URL) by groupId from search_scenes or get_event.",
      inputSchema: z.object({ groupId: z.string().min(1) }),
      annotations: READ_ONLY,
    },
    async (a) => call(api, `/api/scenes/${enc(a.groupId)}`),
  );

  server.registerTool(
    "list_events",
    {
      title: "List story events",
      description: "Story events with title and episode count (get_event lists the scenes). q matches the event id or title, ignoring punctuation.",
      inputSchema: z.object({
        q: z.string().optional(),
        limit: LIMIT,
        offset: OFFSET,
      }),
      annotations: READ_ONLY,
    },
    async (a) => call(api, `/api/events${qs({ q: a.q, limit: a.limit, offset: a.offset, fields: "id,title,episodes,totalLines" })}`),
  );

  server.registerTool(
    "get_event",
    {
      title: "Get story event",
      description: "One story event with its scenes in story order (groupId, name, line count).",
      inputSchema: z.object({ id: z.string().min(1).describe("Event id, e.g. event_claymore") }),
      annotations: READ_ONLY,
    },
    async (a) => call(api, `/api/events/${enc(a.id)}`),
  );

  server.registerTool(
    "search_favorites",
    {
      title: "Search favorite items (소장품)",
      description: "Favorite items (소장품) list. Use get_favorite for per-level stats and skills.",
      inputSchema: z.object({
        q: z.string().optional(),
        rare: z.string().optional().describe("SSR / SR / R"),
        lang: LANG,
      }),
      annotations: READ_ONLY,
    },
    async (a) => call(api, `/api/favorites${qs({ q: a.q, rare: a.rare, lang: a.lang })}`),
  );

  server.registerTool(
    "get_favorite",
    {
      title: "Get favorite item detail",
      description: "Favorite item (소장품) detail: stats per level, collection and exclusive skills.",
      inputSchema: z.object({ id: z.string().min(1), lang: LANG }),
      annotations: READ_ONLY,
    },
    async (a) => call(api, `/api/favorites/${enc(a.id)}${qs({ lang: a.lang })}`),
  );

  server.registerTool(
    "api_get",
    {
      title: "Call any read endpoint",
      description:
        "GET any other nikke-api endpoint, e.g. /api/stages?chapter=1, /api/costumes?nikke=라피, /api/equips, /api/cubes, /api/avatars, /api/meta/filters, /api/tables. See /openapi.json for every route and parameter.",
      inputSchema: z.object({
        path: z.string().startsWith("/api/").describe("Path with query string, starting with /api/"),
      }),
      annotations: READ_ONLY,
    },
    async (a) => {
      if (a.path.includes("..")) return { content: [{ type: "text" as const, text: "invalid path" }], isError: true };
      return call(api, a.path);
    },
  );

  // live account data — upstream game API calls through the server's
  // configured BlablaLink session, so these touch the outside world
  const LIVE = { readOnlyHint: true, openWorldHint: true } as const;

  server.registerTool(
    "get_user_profile",
    {
      title: "Get player profile",
      description: "A player's public profile (nickname, level, team combat, campaign progress, towers) from their BlablaLink share id.",
      inputSchema: z.object({ blablaid: BLABLAID, lang: LANG }),
      annotations: LIVE,
    },
    async (a) => call(api, `/api/user${qs({ blablaid: a.blablaid, lang: a.lang })}`),
  );

  server.registerTool(
    "get_user_nikkes",
    {
      title: "List a player's NIKKEs",
      description: "Characters a player owns with their level. Filters work like search_nikkes; use get_user_nikke for one character's full build.",
      inputSchema: z.object({
        blablaid: BLABLAID,
        name: z.string().optional().describe("Name substring, any language"),
        element: z.string().optional(),
        class: z.string().optional(),
        burst: z.string().optional(),
        corporation: z.string().optional(),
        weapon: z.string().optional(),
        rarity: z.string().optional(),
        lang: LANG,
      }),
      annotations: LIVE,
    },
    async (a) =>
      call(
        api,
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
  );

  server.registerTool(
    "get_user_nikke",
    {
      title: "Get one of a player's NIKKEs",
      description: "Build detail of one owned character: skill levels, equipment, cube, favorite item.",
      inputSchema: z.object({
        blablaid: BLABLAID,
        nameOrId: z.string().min(1).describe("Character name (partial, any language) or id"),
        lang: LANG,
      }),
      annotations: LIVE,
    },
    async (a) => call(api, `/api/user/nikke/${enc(a.nameOrId)}${qs({ blablaid: a.blablaid, lang: a.lang })}`),
  );

  server.registerTool(
    "get_user_roster",
    {
      title: "Get a player's full roster",
      description: "Every owned character with build details across servers. Slow and large — prefer get_user_nikkes unless you need all builds.",
      inputSchema: z.object({
        blablaid: BLABLAID,
        area: z.number().int().optional().describe("Server area id, e.g. 83 = Korea; omit to sweep all servers"),
      }),
      annotations: LIVE,
    },
    async (a) => call(api, `/api/user/roster${qs({ blablaid: a.blablaid, area: a.area })}`),
  );

  return server;
}

export const createNikkeMcp = (api: Fetcher, version: string) =>
  createMcpHandler(() => buildServer(api, version));
