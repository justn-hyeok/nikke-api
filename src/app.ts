import { Hono } from "hono";
import { cors } from "hono/cors";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { cdnUrl } from "./cdn.js";
import type { Nikke } from "./types.js";

const DIST = path.resolve("data/dist");

interface CharacterData {
  count: number;
  syncedAt: string;
  characters: Nikke[];
}

const characterData: CharacterData = JSON.parse(
  await readFile(path.join(DIST, "characters.json"), "utf8"),
);
const characters = characterData.characters;
const byId = new Map(characters.map((c) => [c.id, c]));
const byResourceId = new Map(characters.map((c) => [c.resourceId, c]));
const detailCache = new Map<number, unknown>();

async function getDetail(id: number): Promise<unknown | null> {
  if (detailCache.has(id)) return detailCache.get(id);
  try {
    const d = JSON.parse(await readFile(path.join(DIST, "details", `${id}.json`), "utf8"));
    detailCache.set(id, d);
    return d;
  } catch {
    detailCache.set(id, null);
    return null;
  }
}

async function withDetail(n: Nikke): Promise<unknown> {
  const details = await getDetail(n.id);
  return details ? { ...n, details } : n;
}

const norm = (s: string) => s.toLowerCase().replace(/[\s:_\-·]/g, "");

function findByName(q: string): Nikke[] {
  const nq = norm(q);
  const matches = characters.filter((c) => Object.values(c.name).some((n) => norm(n).includes(nq)));
  // exact matches first, then the rest
  return matches.sort((a, b) => {
    const ae = Object.values(a.name).some((n) => norm(n) === nq) ? 0 : 1;
    const be = Object.values(b.name).some((n) => norm(n) === nq) ? 0 : 1;
    return ae - be;
  });
}

const app = new Hono();
app.use("*", cors());

app.get("/", (c) =>
  c.json({
    name: "nikke-data-api",
    version: "0.1.0",
    source: "Unofficial — data © SHIFT UP / Level Infinite",
    syncedAt: characterData.syncedAt,
    endpoints: {
      "GET /api/nikkes": "list; filters: q, element, class, burst, corporation, weapon, rarity",
      "GET /api/nikkes/:id": "detail by id / resourceId / name (fuzzy)",
      "GET /api/meta/filters": "available filter values",
      "GET /api/scenes": "story scene index (ko)",
      "GET /api/scenes/:groupId": "scene dialogue lines (ko)",
      "GET /api/tables": "list raw table files",
      "GET /api/tables/:file": "raw synced table JSON",
      "GET /api/cdn?path=": "resolve a Blablalink CDN resource path to its URL",
    },
  }),
);

app.get("/api/nikkes", (c) => {
  const { q, element, class: cls, burst, corporation, weapon, rarity } = c.req.query();
  let list = characters;
  if (q) list = findByName(q);
  const n = (v?: string) => v?.toLowerCase();
  if (element) list = list.filter((x) => n(x.element ?? undefined) === n(element));
  if (cls) list = list.filter((x) => n(x.class) === n(cls));
  if (burst) list = list.filter((x) => n(x.burst) === n(burst));
  if (corporation) list = list.filter((x) => n(x.corporation) === n(corporation));
  if (weapon) list = list.filter((x) => n(x.weapon.type ?? undefined) === n(weapon));
  if (rarity) list = list.filter((x) => n(x.rarity) === n(rarity));
  return c.json({ count: list.length, characters: list });
});

app.get("/api/nikkes/:id", async (c) => {
  const key = c.req.param("id");
  if (/^\d+$/.test(key)) {
    const n = Number(key);
    const hit = byId.get(n) ?? byResourceId.get(n);
    if (hit) return c.json(await withDetail(hit));
  }
  const hits = findByName(key);
  if (hits.length === 1) return c.json(await withDetail(hits[0]));
  if (hits.length > 1) return c.json({ count: hits.length, characters: hits });
  return c.json({ error: "not found" }, 404);
});

app.get("/api/meta/filters", (c) => {
  const uniq = <T>(arr: (T | null | undefined)[]) => [...new Set(arr.filter(Boolean))] as T[];
  return c.json({
    elements: uniq(characters.map((x) => x.element)),
    classes: uniq(characters.map((x) => x.class)),
    bursts: uniq(characters.map((x) => x.burst)),
    corporations: uniq(characters.map((x) => x.corporation)),
    weapons: uniq(characters.map((x) => x.weapon.type)),
    rarities: uniq(characters.map((x) => x.rarity)),
  });
});

app.get("/api/scenes", async (c) => {
  const { q, category, nikke, limit, offset } = c.req.query();
  try {
    let list: {
      groupId: string;
      name?: string;
      lines: number;
      category?: string;
      nikke?: string;
    }[] = JSON.parse(await readFile(path.join(DIST, "scenes.json"), "utf8"));
    if (category) list = list.filter((s) => s.category === category);
    if (nikke) list = list.filter((s) => s.nikke?.includes(nikke));
    if (q) list = list.filter((s) => s.groupId.includes(q) || s.name?.includes(q));
    const total = list.length;
    const off = Math.max(0, Number(offset) || 0);
    const lim = Math.min(Math.max(0, Number(limit) || 0), 500) || total;
    return c.json({ count: total, offset: off, scenes: list.slice(off, off + lim) });
  } catch {
    return c.json({ count: 0, scenes: [] });
  }
});

app.get("/api/scenes/:groupId", async (c) => {
  const gid = c.req.param("groupId");
  if (!/^[\w-]+$/.test(gid)) return c.json({ error: "invalid groupId" }, 400);
  try {
    const body = await readFile(path.join(DIST, "scenes", `${gid}.json`), "utf8");
    return c.body(body, 200, { "Content-Type": "application/json" });
  } catch {
    return c.json({ error: "not found" }, 404);
  }
});

app.get("/api/tables", async (c) => {
  const files = await readdir(path.join(DIST, "tables"));
  return c.json({ files });
});

app.get("/api/tables/:file", async (c) => {
  const file = c.req.param("file");
  if (!/^[\w.-]+\.json$/.test(file)) return c.json({ error: "invalid file" }, 400);
  try {
    const body = await readFile(path.join(DIST, "tables", file), "utf8");
    return c.body(body, 200, { "Content-Type": "application/json" });
  } catch {
    return c.json({ error: "not found" }, 404);
  }
});

app.get("/api/cdn", (c) => {
  const p = c.req.query("path");
  if (!p || p.includes("..")) return c.json({ error: "path required" }, 400);
  return c.json({ path: p, url: cdnUrl(p) });
});

export default app;
