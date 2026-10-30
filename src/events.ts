// Shared event_* helpers. scripts/build.ts writes events.json and app.ts's
// legacy fallback groups scenes on the fly — both need the same event-id
// stripping and story-order scene sorting. A plain .sort() is wrong twice
// over: _01_e lands before _01_s, and _epilogue/_intermission come before
// _prologue alphabetically.

// strip repeatedly — ids like event_ce006_1_01_e nest a collab part number
// and an episode number
export const eventIdOf = (gid: string) => {
  let prev = gid;
  for (;;) {
    const next = prev.replace(
      /(_\d+(_[es])?|_[es]|_(prologue|epilogue|intermission|end))$/,
      "",
    );
    if (next === prev) return prev;
    prev = next;
  }
};

type Section =
  | { kind: "prologue" | "epilogue" | "end" }
  | { kind: "episode"; n: number; ab: "s" | "e" | "" }
  | { kind: "intermission"; n: number }
  | { kind: "other"; raw: string };

// split the id tail (after the event id) into sections: 01_s -> episode 1
// part A, intermission_02 -> intermission 2
const sectionsOf = (tail: string): Section[] => {
  const out: Section[] = [];
  const t = tail.split("_");
  for (let i = 0; i < t.length; i++) {
    const tok = t[i];
    if (tok === "prologue" || tok === "epilogue" || tok === "end") {
      out.push({ kind: tok });
    } else if (tok === "intermission") {
      const n = /^\d+$/.test(t[i + 1] ?? "") ? Number(t[++i]) : 0;
      out.push({ kind: "intermission", n });
    } else if (/^\d+$/.test(tok)) {
      let ab: "s" | "e" | "" = "";
      if (t[i + 1] === "s" || t[i + 1] === "e") ab = t[++i] as "s" | "e";
      out.push({ kind: "episode", n: Number(tok), ab });
    } else if (tok === "s" || tok === "e") {
      // side-story ids like event_lastkingdom1_b02_s — eventIdOf strips only
      // the trailing _s/_e, leaving a bare token that marks part A/B
      out.push({ kind: "episode", n: 0, ab: tok });
    } else {
      out.push({ kind: "other", raw: tok });
    }
  }
  return out;
};

type Rank = readonly (number | string)[];

// story order: prologue, episodes ascending (_s is part A, _e part B — a
// bare _NN sits between them), intermissions, epilogue, end, then unknowns
const rankOf = (s: Section): Rank => {
  switch (s.kind) {
    case "prologue":
      return [0];
    case "episode":
      return [1, s.n, s.ab === "s" ? 0 : s.ab === "e" ? 2 : 1];
    case "intermission":
      return [2, s.n];
    case "epilogue":
      return [3];
    case "end":
      return [4];
    default:
      return [5, s.raw];
  }
};

// sort key: [part, ...section ranks]. Collab ids nest a part number —
// event_ce004_2_05 is part 2, episode 5 — so a leading bare _NN counts as
// the part only when more sections follow it.
const keyOf = (gid: string): Rank[] => {
  const tail = gid.slice(eventIdOf(gid).length).replace(/^_/, "");
  const secs = tail ? sectionsOf(tail) : [];
  const [head, ...rest] = secs;
  const part = rest.length && head?.kind === "episode" && head.ab === "" ? head.n : 0;
  return [[part], ...(part ? rest : secs).map(rankOf)];
};

const cmpRank = (a: Rank, b: Rank): number => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) continue;
    return typeof a[i] === "number" && typeof b[i] === "number"
      ? (a[i] as number) - (b[i] as number)
      : String(a[i]) < String(b[i])
        ? -1
        : 1;
  }
  return a.length - b.length;
};

// story-order comparator for scene groupIds within one event
export const compareEventScenes = (a: string, b: string): number => {
  const ka = keyOf(a);
  const kb = keyOf(b);
  for (let i = 0; i < Math.min(ka.length, kb.length); i++) {
    const d = cmpRank(ka[i], kb[i]);
    if (d) return d;
  }
  return ka.length - kb.length || a.localeCompare(b);
};

// legacy fallback for a dist without events.json: group event_* scene index
// entries per event in story order (title falls back to the id)
export const groupEventScenes = (
  scenes: { groupId: string; lines: number; category?: string; source?: string }[],
) => {
  const groups = new Map<
    string,
    { id: string; title: string; episodes: number; totalLines: number; scenes: string[]; source?: string }
  >();
  for (const s of scenes.filter((x) => x.category === "event")) {
    const id = eventIdOf(s.groupId);
    const e = groups.get(id) ?? { id, title: id, episodes: 0, totalLines: 0, scenes: [] };
    e.episodes++;
    e.totalLines += s.lines;
    e.scenes.push(s.groupId);
    if (s.source) e.source = s.source;
    groups.set(id, e);
  }
  for (const e of groups.values()) e.scenes.sort(compareEventScenes);
  return groups;
};
