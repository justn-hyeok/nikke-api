import crypto from "node:crypto";
import { cdnUrl } from "../src/cdn.js";

// Representative files whose content changes when game data updates.
// roledata/scene_detail-only changes are covered by the weekly forced redeploy.
const PATHS = [
  "character/ko/nikke_list_v2.json",
  "character/en/nikke_list_en_v2.json",
  "character/ja/nikke_list_ja_v2.json",
  "character/zh-TW/nikke_list_zh-TW_v2.json",
  "character/character_id_map.json",
  "character/character_skill_map.json",
  "character/CharacterLevelTable.json",
  "character/AttractiveLevelTable.json",
  "scene/ko/scene_list.json",
  "archive/ko/archive_list.json",
  "scene/ko/sudden_list.json",
  "equip/ItemEquipTable-ko.json",
  "equip/equip_option_table_v2-ko.json",
  "tower/tower_list.json",
  "stage/stage_list.json",
];

async function main() {
  const hash = crypto.createHash("sha256");
  let ok = 0;
  for (const p of PATHS) {
    const res = await fetch(cdnUrl(p));
    if (!res.ok) {
      console.log(`warn: ${res.status} ${p}`);
      continue;
    }
    hash.update(await res.text());
    ok++;
  }
  console.log(`fingerprint over ${ok}/${PATHS.length} files:`);
  console.log(hash.digest("hex"));
}

main();
