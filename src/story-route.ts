// A play order for the story: main chapters with the events and side stories
// slotted where the community recommends reading them. Curated, not derived —
// every placement names the sources it rests on (keys of ROUTE_SOURCES).
//
// Skeleton: the in-game Storyline mode (A). That mode files the "past" lore
// events (Over Zone, Red Ash, Old Tales, Footstep Walk Run, New Year New
// Sword, Mudfish) before Chapter 0 because they happen earlier in-world;
// for a first read they go where players recommend instead (B–E).
// Chapter numbers are the game's (0-based); scene groupIds are 1-based
// (Chapter 0 = d_main_01_*).

export const ROUTE_SOURCES = {
  A: {
    title: "The NIKKE Storyline (History Order - Up to Chapter 42) — in-game Storyline mode",
    author: "justonegamr",
    url: "https://www.youtube.com/watch?v=tsJNzjSr1Qg",
    date: "2025-12-04",
  },
  B: {
    title: "니케 메인스토리 몰아보기 0~40챕터",
    author: "샘웨",
    url: "https://www.youtube.com/watch?v=1jdxSRGgq_0",
    date: "2025-10-02",
  },
  C: {
    title: "신입 지휘관들을 위한 주관적인 스토리 순서 추천",
    author: "흐냠",
    url: "https://www.youtube.com/watch?v=dqPXnJkjpsQ",
    date: "2025-04-03",
  },
  D: {
    title: "니케 스토리 몰아보기 (상편/하편)",
    author: "당청",
    url: "https://www.youtube.com/watch?v=sT6rXWjIcBA",
    date: "2024-09-02",
  },
  E: {
    title: "Complete Beginner's Guide to the Archives (+Side Stories)",
    author: "Ginnungagap III",
    url: "https://www.youtube.com/watch?v=JMjaeEo13RU",
    date: "2025-11-18",
  },
} as const;

export type RouteSource = keyof typeof ROUTE_SOURCES;

/** last game chapter any source places events around */
export const ROUTE_COVERAGE_CHAPTER = 42;

export type RouteEntry =
  | { kind: "main"; chapter: number }
  | { kind: "event"; id: string; basis: RouteSource[]; note?: string }
  // stories the data has no scenes for — kept so the order stays honest
  | { kind: "missing"; title: string; type: "side" | "event"; basis: RouteSource[]; note?: string };

const ch = (...nums: number[]): RouteEntry[] => nums.map((chapter) => ({ kind: "main", chapter }));
const range = (from: number, to: number) => ch(...Array.from({ length: to - from + 1 }, (_, i) => from + i));
const ev = (id: string, basis: RouteSource[], note?: string): RouteEntry => ({ kind: "event", id, basis, ...(note ? { note } : {}) });
const side = (title: string, basis: RouteSource[], note?: string): RouteEntry => ({ kind: "missing", type: "side", title, basis, ...(note ? { note } : {}) });

export const STORY_ROUTE: RouteEntry[] = [
  ...range(0, 2),
  ev("event_nocallerid", ["A"]),
  ...range(3, 14),
  side("SECOND AFFECTION", ["A", "C"], "FIRST AFFECTION을 먼저 읽는 걸 권장 (E)"),
  ...ch(15),
  ev("event_boomsday", ["A"]),
  ev("event_overthehorizon", ["A"]),
  ev("event_newflavor", ["A"]),
  ev("event_trueflavor", ["A"]),
  ...range(16, 18),
  ev("event_wisdomspring", ["A"], "로어 비중이 큰 이벤트 (E)"),
  ...ch(19),
  ev("event_overzone1", ["C", "D"], "C는 20챕터 전(19챕터 전도 무방), D는 20챕터 뒤"),
  ev("event_overzone2", ["C", "D"]),
  ...range(20, 24),
  side("WORDLESS", ["A", "C"]),
  ...ch(25),
  ev("event_redash1", ["C", "D"], "C는 25챕터 뒤(26챕터 뒤도 무방), D는 25챕터 전"),
  ev("event_redash2", ["C", "D"]),
  ev("event_newyearnewsword", ["E"], "챕터 위치를 정한 소스는 없음 — E의 로어 순서(레드 애쉬 → 뉴 이어 뉴 스워드 → 라스트 킹덤)를 따름"),
  ...ch(26),
  ev("event_lastkingdom1", ["A", "B", "C", "D"], "모든 소스가 26챕터 뒤로 일치"),
  ev("event_lastkingdom2", ["A", "B", "C", "D"]),
  ev("event_dirtybackyard", ["A"], "식스오 첫 등장 (E)"),
  { kind: "missing", type: "event", title: "MEMORIES TELLER (스텔라 블레이드 콜라보)", basis: ["A"] },
  ev("event_darkhero", ["A"]),
  ev("event_killthelord", ["A"]),
  ...range(27, 32),
  ev("event_oldtales1", ["B", "C"]),
  ev("event_oldtales2", ["B", "C"]),
  ...range(33, 34),
  ev("event_footstepwalkrun1", ["C"], "B는 39챕터 중간에 배치"),
  ev("event_footstepwalkrun2", ["C"]),
  side("MUDFISH", ["E"], "챕터 위치를 정한 소스는 없음 — E: 언브레이커블 스피어 전에"),
  ev("event_arcanearchive", ["A"]),
  { kind: "missing", type: "event", title: "BOOM! THE GHOST", basis: ["A"] },
  ev("event_absolute1", ["A"]),
  ev("event_absolute2", ["A"]),
  ...ch(35),
  ev("event_unbreakablesphere1", ["A"], "B는 38챕터 중간에 배치"),
  ...ch(36),
  ev("event_unbreakablesphere2", ["A"]),
  ...range(37, 39),
  side("EDEN SPEAR", ["A", "E"]),
  ...ch(40),
  ev("event_goddessfall1", ["A"]),
  ...ch(41),
  ev("event_goddessfall2", ["A"]),
  ...ch(42),
];
