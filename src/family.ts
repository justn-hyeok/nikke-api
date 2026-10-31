import type { Nikke } from "./types.js";

// alternate versions (이격) are named "<base> : <variant>" in every locale
// ("라피 : 레드 후드" / "Rapi: Red Hood"), so the part before the colon ties
// a variant to its original. The data has no explicit link, hence the rule.
// A few variants keep their base under another name — those are mapped here.
const BASE_OVERRIDES: Record<string, string> = {
  // Modernia is Marian after corruption; "마리안 : 퀸" is the same person
  모더니아: "마리안",
};

const key = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const baseName = (name: string) => name.split(/\s*:\s*/)[0];

export interface Family {
  /** base name in Korean, e.g. "라피" — also the family's id */
  base: string;
  members: Nikke[];
}

export function buildFamilies(characters: Nikke[]) {
  // base name (any locale) → family key (Korean base)
  const keyOf = new Map<string, string>();
  const familyKey = (n: Nikke) => {
    const ko = n.name.ko ?? Object.values(n.name)[0] ?? String(n.id);
    return BASE_OVERRIDES[ko] ?? baseName(ko);
  };
  const families = new Map<string, Family>();
  for (const n of characters) {
    const fk = familyKey(n);
    let f = families.get(fk);
    if (!f) families.set(fk, (f = { base: fk, members: [] }));
    f.members.push(n);
    for (const name of Object.values(n.name)) keyOf.set(key(baseName(name)), fk);
    keyOf.set(key(fk), fk);
  }
  // originals first, then variants in data order
  for (const f of families.values()) {
    f.members.sort((a, b) => Number(baseName(a.name.ko ?? "") !== a.name.ko) - Number(baseName(b.name.ko ?? "") !== b.name.ko));
  }
  const byNikke = new Map<number, Family>();
  for (const f of families.values()) for (const m of f.members) byNikke.set(m.id, f);

  return {
    /** the family a character belongs to */
    of: (n: Nikke) => byNikke.get(n.id)!,
    /** family by a base or full name in any locale ("라피", "Rapi: Red Hood") */
    byName: (name: string) => families.get(keyOf.get(key(baseName(name))) ?? keyOf.get(key(name)) ?? ""),
    /** every name (all locales, full and base) the family's members go by */
    names: (f: Family) => [
      ...new Set(f.members.flatMap((m) => Object.values(m.name).flatMap((nm) => [nm, baseName(nm)]))),
    ],
    /** a compact {base, members} view for responses */
    view: (f: Family) => ({
      base: f.base,
      members: f.members.map((m) => ({ id: m.id, name: m.name })),
    }),
  };
}
