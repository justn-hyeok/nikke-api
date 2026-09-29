import { Hono } from "hono";
import { cors } from "hono/cors";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { cdnUrl } from "./cdn.js";
import { decodeOpenid, gameApi, playerInfo } from "./blabla.js";
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

// --- profile normalization helpers ---
let nameCodeMap: Record<string, { id: number; resourceId: number }> | null = null;
let favNameMap: Map<number, Record<string, string>> | null = null;
let cubeNameMap: Map<number, { name: Record<string, string>; rare?: string }> | null = null;

async function loadNameCodeMap() {
  if (!nameCodeMap) {
    try {
      nameCodeMap = JSON.parse(await readFile(path.join(DIST, "name_code_map.json"), "utf8"));
    } catch {
      nameCodeMap = {};
    }
  }
  return nameCodeMap;
}

async function loadFavNames() {
  if (!favNameMap) {
    favNameMap = new Map();
    try {
      const list = JSON.parse(await readFile(path.join(DIST, "favorites.json"), "utf8"));
      for (const f of list) favNameMap.set(f.id, f.name);
    } catch { /* empty */ }
  }
  return favNameMap;
}

async function loadCubeNames() {
  if (!cubeNameMap) {
    cubeNameMap = new Map();
    try {
      const list = JSON.parse(await readFile(path.join(DIST, "cubes.json"), "utf8"));
      for (const cu of list) cubeNameMap.set(cu.id, cu);
    } catch { /* empty */ }
  }
  return cubeNameMap;
}

const CORP_NAMES: Record<number, string> = {
  1: "ELYSION",
  2: "MISSILIS",
  3: "TETRA",
  4: "PILGRIM",
  7: "ABNORMAL",
};

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
      "GET /api/favorites": "소장품(favorite item) list; filters: q, rare",
      "GET /api/favorites/:id": "소장품 detail — per-level stats, skills",
      "GET /api/cubes": "하모니 큐브 list; filter: q",
      "GET /api/cubes/:id": "큐브 detail — per-level stats, skills",
      "GET /api/tables": "list raw table files",
      "GET /api/tables/:file": "raw synced table JSON",
      "GET /api/cdn?path=": "resolve a Blablalink CDN resource path to its URL",
      "GET /api/user?openid=":
        "shared-profile lookup (blablalink user link or raw openid)",
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

app.get("/api/favorites", async (c) => {
  const { q, rare } = c.req.query();
  try {
    let list: {
      id: number;
      rare?: string;
      name: Record<string, string>;
      weaponType?: string;
    }[] = JSON.parse(await readFile(path.join(DIST, "favorites.json"), "utf8"));
    if (rare) list = list.filter((x) => x.rare?.toLowerCase() === rare.toLowerCase());
    if (q) {
      const nq = norm(q);
      list = list.filter((x) => Object.values(x.name).some((n) => norm(n).includes(nq)));
    }
    return c.json({ count: list.length, favorites: list });
  } catch {
    return c.json({ count: 0, favorites: [] });
  }
});

app.get("/api/favorites/:id", async (c) => {
  const id = c.req.param("id");
  if (!/^\d+$/.test(id)) return c.json({ error: "invalid id" }, 400);
  try {
    const body = await readFile(path.join(DIST, "favorites", `${id}.json`), "utf8");
    return c.body(body, 200, { "Content-Type": "application/json" });
  } catch {
    return c.json({ error: "not found" }, 404);
  }
});

app.get("/api/cubes", async (c) => {
  const { q } = c.req.query();
  try {
    let list: { id: number; rare?: string; name: Record<string, string> }[] = JSON.parse(
      await readFile(path.join(DIST, "cubes.json"), "utf8"),
    );
    if (q) {
      const nq = norm(q);
      list = list.filter((x) => Object.values(x.name).some((n) => norm(n).includes(nq)));
    }
    return c.json({ count: list.length, cubes: list });
  } catch {
    return c.json({ count: 0, cubes: [] });
  }
});

app.get("/api/cubes/:id", async (c) => {
  const id = c.req.param("id");
  if (!/^\d+$/.test(id)) return c.json({ error: "invalid id" }, 400);
  try {
    const body = await readFile(path.join(DIST, "cubes", `${id}.json`), "utf8");
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

app.get("/api/user", async (c) => {
  const q = c.req.query("openid") ?? c.req.query("url") ?? "";
  const target = decodeOpenid(q);
  if (!target) return c.json({ error: "invalid openid" }, 400);
  try {
    const info = await playerInfo<{ area_id?: string }>(target.intlOpenId);
    if (info.code !== 0 || !info.data)
      return c.json({ error: info.msg ?? "lookup failed", code: info.code }, 502);
    const areaId = Number(info.data.area_id ?? 0);
    const body = { intl_open_id: target.intlOpenId, nikke_area_id: areaId };
    const [basic, outpost, chars] = await Promise.all([
      gameApi("Game", "GetUserProfileBasicInfo", body),
      gameApi("Game", "GetUserProfileOutpostInfo", body),
      gameApi("Game", "GetUserCharacters", body),
    ]);
    const codes =
      ((chars.data as { characters?: { name_code?: number }[] } | null)?.characters ?? [])
        .map((x) => x.name_code)
        .filter((x): x is number => !!x);
    const details = codes.length
      ? await gameApi("Game", "GetUserCharacterDetails", { ...body, name_codes: codes })
      : { code: -1, data: null };

    const [ncMap, favNames, cubeNames] = await Promise.all([
      loadNameCodeMap(),
      loadFavNames(),
      loadCubeNames(),
    ]);
    const charRef = (nameCode?: number | null) => {
      if (!nameCode) return null;
      const e = ncMap?.[String(nameCode)];
      const n = e ? byId.get(e.id) : undefined;
      if (!n) return { nameCode };
      return {
        nameCode,
        id: n.id,
        resourceId: n.resourceId,
        name: n.name,
        rarity: n.rarity,
        class: n.class,
        burst: n.burst,
        corporation: n.corporation,
        element: n.element,
        image: n.images.icon,
      };
    };
    const cubeRef = (tid?: number, lv?: number) =>
      !tid ? null : { id: tid, level: lv ?? 0, name: cubeNames.get(tid)?.name ?? null };
    const favRef = (tid?: number, lv?: number) =>
      !tid ? null : { id: tid, level: lv ?? 0, name: favNames.get(tid) ?? null };
    const equipRef = (d: Record<string, any>, slot: string) => {
      const tid = d[`${slot}_equip_tid`];
      if (!tid) return null;
      return {
        tid,
        tier: d[`${slot}_equip_tier`] ?? 0,
        level: d[`${slot}_equip_lv`] ?? 0,
        corporation: CORP_NAMES[d[`${slot}_equip_corporation_type`]] ?? null,
        options: [1, 2, 3].map((i) => d[`${slot}_equip_option${i}_id`]).filter(Boolean),
      };
    };

    const bi = (basic.data as any)?.basic_info ?? {};
    const op = (outpost.data as any)?.outpost_info ?? {};
    const detailByCode = new Map<number, any>(
      ((details.data as any)?.character_details ?? []).map((x: any) => [x.name_code, x]),
    );
    const nikkes = (
      ((chars.data as any)?.characters ?? []) as any[]
    ).map((ch) => {
      const d = detailByCode.get(ch.name_code) ?? {};
      return {
        character: charRef(ch.name_code),
        level: ch.lv ?? d.lv ?? 0,
        combat: ch.combat ?? d.combat ?? 0,
        arenaCombat: d.arena_combat ?? 0,
        grade: ch.grade ?? d.grade ?? 0,
        core: ch.core ?? d.core ?? 0,
        costumeTid: d.costume_tid || ch.costume_id || null,
        skills: { skill1: d.skill1_lv ?? 0, skill2: d.skill2_lv ?? 0, burst: d.ulti_skill_lv ?? 0 },
        attractiveLevel: d.attractive_lv ?? 0,
        favoriteItem: favRef(d.favorite_item_tid, d.favorite_item_lv),
        cube: cubeRef(d.harmony_cube_tid, d.harmony_cube_lv),
        arenaCube: cubeRef(d.arena_harmony_cube_tid, d.arena_harmony_cube_lv),
        equipment: {
          head: equipRef(d, "head"),
          torso: equipRef(d, "torso"),
          arm: equipRef(d, "arm"),
          leg: equipRef(d, "leg"),
        },
      };
    });
    nikkes.sort((a, b) => b.combat - a.combat);

    const corporations: Record<string, number> = {};
    for (const x of bi.corporation_character_counts ?? []) {
      corporations[CORP_NAMES[x.corporation_type] ?? `TYPE_${x.corporation_type}`] = x.count;
    }

    return c.json({
      intlOpenId: target.intlOpenId,
      areaId,
      summary: info.data,
      profile: {
        nickname: bi.nickname ?? bi.role_name,
        level: bi.lv,
        icon: charRef(bi.icon_id),
        iconIsPrism: !!bi.is_icon_prism,
        avatarFrame: bi.avatar_frame ?? 0,
        teamCombat: bi.team_combat,
        gsn: bi.gsn,
        nikkeCount: bi.character_count,
        costumeCount: bi.character_costume_count,
        campaign: {
          normal: bi.progress_normal_campaign,
          hard: bi.progress_hard_campaign,
          easy: bi.progress_easy_campaign,
        },
        towers: {
          tribe: bi.progress_tribe_tower,
          tetra: bi.progress_tetra_tower,
          elysion: bi.progress_elysion_tower,
          missilis: bi.progress_missilis_tower,
          pilgrim: bi.progress_pilgrim_tower,
        },
        corporations,
        currencies: bi.currencies ?? [],
        overclock: {
          currentSubSeasonHighScore: bi.sim_room_overclock_current_sub_season_high_score,
          latestSeasonHighScore: bi.sim_room_overclock_latest_season_high_score,
          history: (bi.sim_room_overclock_high_score_history ?? []).map((h: any) => ({
            season: h.season,
            optionLevel: h.option_level,
            options: h.option_list ?? [],
          })),
        },
        profileTeam: (bi.profile_team ?? [])
          .map((t: any) => ({ slot: t.slot, character: charRef(t.name_code) }))
          .sort((a: any, b: any) => a.slot - b.slot),
        isBanned: !!bi.is_banned,
        createdAt: Number(bi.created_at) || null,
        lastActionAt: Number(bi.last_action_at) || null,
      },
      outpost: {
        infraCoreLevel: op.infra_core_level,
        outpostBattleLevel: op.outpost_battle_level,
        synchroLevel: op.synchro_level,
        synchroSlotsUsed: op.synchro_nonempty_slot_count,
        jukeboxCount: op.jukebox_count,
        tacticAcademy: { class: op.tactic_academy_class, lesson: op.tactic_academy_lesson },
        recycleRoom: (op.recycle_room_researches ?? []).map((r: any) => ({
          tid: r.tid,
          level: r.lv,
          exp: r.exp,
        })),
        memorials: op.memorial_counts ?? [],
        isHidden: !!op.is_hide,
      },
      nikkes,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes("not configured") ? 503 : 502;
    return c.json({ error: msg }, status);
  }
});

app.get("/api/cdn", (c) => {
  const p = c.req.query("path");
  if (!p || p.includes("..")) return c.json({ error: "path required" }, 400);
  return c.json({ path: p, url: cdnUrl(p) });
});

export default app;
