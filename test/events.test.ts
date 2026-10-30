import assert from "node:assert/strict";
import { test } from "node:test";

import { compareEventScenes, eventIdOf, groupEventScenes } from "../src/events.js";

const sorted = (ids: string[]) => [...ids].sort(compareEventScenes);

test("eventIdOf strips episode/prologue/intermission suffixes", () => {
  assert.equal(eventIdOf("event_claymore_01_s"), "event_claymore");
  assert.equal(eventIdOf("event_claymore_intermission_01"), "event_claymore");
  assert.equal(eventIdOf("event_firstaffection_02"), "event_firstaffection");
  // collab ids nest a part number before the scene section
  assert.equal(eventIdOf("event_ce004_1_01_e"), "event_ce004");
  assert.equal(eventIdOf("event_ce004_2_05"), "event_ce004");
});

test("plain event scenes sort in story order, not lexicographically", () => {
  // event_claymore's real shape — .sort() put _01_e before _01_s and
  // _epilogue/_intermission_01 before _prologue
  const shuffled = [
    "event_claymore_01_e",
    "event_claymore_epilogue",
    "event_claymore_03_s",
    "event_claymore_intermission_01",
    "event_claymore_prologue",
    "event_claymore_02_s",
    "event_claymore_01_s",
    "event_claymore_02_e",
    "event_claymore_03_e",
  ];
  assert.deepEqual(sorted(shuffled), [
    "event_claymore_prologue",
    "event_claymore_01_s",
    "event_claymore_01_e",
    "event_claymore_02_s",
    "event_claymore_02_e",
    "event_claymore_03_s",
    "event_claymore_03_e",
    "event_claymore_intermission_01",
    "event_claymore_epilogue",
  ]);
});

test("episodes sort numerically; intermissions, epilogue, end trail", () => {
  const shuffled = [
    "event_x_end",
    "event_x_10",
    "event_x_epilogue",
    "event_x_2",
    "event_x_intermission_02",
    "event_x_intermission",
    "event_x_intermission_01",
  ];
  assert.deepEqual(sorted(shuffled), [
    "event_x_2",
    "event_x_10",
    "event_x_intermission",
    "event_x_intermission_01",
    "event_x_intermission_02",
    "event_x_epilogue",
    "event_x_end",
  ]);
});

test("side-story ids: a bare _s/_e tail sorts part A before part B", () => {
  // event_lastkingdom1_b02's real scenes — _s is ': A', _e is ': B'. The
  // _bNN stays in the event id, so the tail is a lone s/e token.
  assert.equal(eventIdOf("event_lastkingdom1_b02_s"), "event_lastkingdom1_b02");
  assert.equal(eventIdOf("event_lastkingdom1_b02_e"), "event_lastkingdom1_b02");
  assert.deepEqual(
    sorted(["event_lastkingdom1_b02_e", "event_lastkingdom1_b02_s"]),
    ["event_lastkingdom1_b02_s", "event_lastkingdom1_b02_e"],
  );
});

test("_NN_s precedes _NN_e; a bare _NN sits at its number", () => {
  assert.deepEqual(
    sorted(["event_y_03_e", "event_y_03", "event_y_03_s", "event_y_02", "event_y_04_s"]),
    ["event_y_02", "event_y_03_s", "event_y_03", "event_y_03_e", "event_y_04_s"],
  );
});

test("collab ids sort by part number, then story order within the part", () => {
  const shuffled = [
    "event_ce004_3_epilogue",
    "event_ce004_2_05",
    "event_ce004_1_01_e",
    "event_ce004_2_01_s",
    "event_ce004_1_prologue",
    "event_ce004_1_01_s",
  ];
  assert.deepEqual(sorted(shuffled), [
    "event_ce004_1_prologue",
    "event_ce004_1_01_s",
    "event_ce004_1_01_e",
    "event_ce004_2_01_s",
    "event_ce004_2_05",
    "event_ce004_3_epilogue",
  ]);
});

test("groupEventScenes (legacy fallback) groups event scenes in story order", () => {
  const groups = groupEventScenes([
    { groupId: "d_main_01_01", lines: 9, category: "main" },
    { groupId: "event_x_01_e", lines: 3, category: "event", source: "archive_list" },
    { groupId: "event_x_prologue", lines: 1, category: "event", source: "archive_list" },
    { groupId: "event_x_01_s", lines: 2, category: "event", source: "archive_list" },
    { groupId: "event_y_01", lines: 4, category: "event" },
  ]);
  assert.deepEqual([...groups.keys()], ["event_x", "event_y"]);
  assert.deepEqual(groups.get("event_x"), {
    id: "event_x",
    title: "event_x",
    episodes: 3,
    totalLines: 6,
    scenes: ["event_x_prologue", "event_x_01_s", "event_x_01_e"],
    source: "archive_list",
  });
  assert.equal(groups.get("event_y")?.source, undefined);
});
