import { mkdir, readFile, writeFile, copyFile, readdir } from "node:fs/promises";
import path from "node:path";
import { cdnUrl } from "../src/cdn.js";
import type {
  Burst,
  Locale,
  Nikke,
  NikkeDetail,
  RawNikke,
  RawRoleData,
  RawSkillDetail,
  Skill,
  SkillIconMap,
} from "../src/types.js";

const RAW = path.resolve("data/raw");
const OUT = path.resolve("data/dist");
const LOCALES: Locale[] = ["ko", "en", "ja", "zh-TW"];

const pad = (n: number, len: number) => String(n).padStart(len, "0");

const BURST_MAP: Record<string, Burst> = {
  Step1: "I",
  Step2: "II",
  Step3: "III",
  AllStep: "All",
};

function images(resourceId: number, skinIndex: number) {
  const rid = pad(resourceId, 3);
  const skin = pad(skinIndex, 2);
  return {
    icon: cdnUrl(`character/si/si_c${rid}_${skin}_s.webp`),
    medium: cdnUrl(`character/mi/mi_c${rid}_${skin}_s.webp`),
    full: cdnUrl(`character/full/c${rid}_${skin}.webp`),
  };
}

const icon = (iconPath: string, name: string) => cdnUrl(`icon/${iconPath}/${name}.webp`);

const GRADE_ICON: Record<string, string> = { SSR: "003", SR: "002", R: "001" };

const skillIcon = (name?: string) =>
  name ? icon("skill/char_skill", name) : undefined;

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path.join(RAW, file), "utf8")) as T;
  } catch {
    return null;
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await mkdir(path.join(OUT, "tables"), { recursive: true });

  // --- merge character lists across locales ---
  const byId = new Map<number, Nikke>();
  for (const locale of LOCALES) {
    const list = await readJson<RawNikke[]>(`nikke_list_${locale}_v2.json`);
    if (!list) continue;
    for (const r of list) {
      let n = byId.get(r.id);
      if (!n) {
        n = {
          id: r.id,
          resourceId: r.resource_id,
          name: {},
          rarity: r.original_rare,
          class: r.class,
          burst: BURST_MAP[r.use_burst_skill] ?? "I",
          corporation: r.corporation,
          element: r.element_id?.element?.element ?? null,
          weapon: {
            type: r.shot_id?.element?.weapon_type ?? null,
            attackType: r.shot_id?.element?.attack_type ?? null,
            ammo: r.shot_id?.element?.ammo ?? null,
          },
          costumes: (r.costumes ?? []).map((c) => ({
            id: c.id,
            skinIndex: c.costume_index,
            images: images(r.resource_id, c.costume_index),
          })),
          images: images(r.resource_id, 0),
          icons: {
            grade: icon("atlas_common_grade", `ele_grade_icon_${GRADE_ICON[r.original_rare]}`),
            class: icon("atlas_common_class", `icn_class_${r.class.toLowerCase()}`),
            element: r.element_id?.element?.element_icon
              ? icon("atlas_common_class", r.element_id.element.element_icon)
              : undefined,
          },
          skillIcons: {},
        };
        byId.set(r.id, n);
      }
      const name = r.name_localkey?.name;
      if (name) n.name[locale] = name;
      // merge costumes as union — some locales ship empty/partial lists
      for (const c of r.costumes ?? []) {
        if (!n.costumes.some((x) => x.id === c.id)) {
          n.costumes.push({
            id: c.id,
            skinIndex: c.costume_index,
            images: images(r.resource_id, c.costume_index),
          });
        }
      }
    }
  }

  // --- attach skill icons ---
  const skillMap = (await readJson<SkillIconMap[]>("character_skill_map.json")) ?? [];
  const skillByRes = new Map(skillMap.map((s) => [s.resource_id, s]));
  for (const n of byId.values()) {
    const s = skillByRes.get(n.resourceId);
    if (s) {
      n.skillIcons = {
        skill1: skillIcon(s.skill1_icon),
        skill2: skillIcon(s.skill2_icon),
        burst: skillIcon(s.ulti_skill_icon),
      };
    }
  }

  const characters = [...byId.values()].sort((a, b) => a.id - b.id);
  await writeFile(
    path.join(OUT, "characters.json"),
    JSON.stringify({ count: characters.length, syncedAt: new Date().toISOString(), characters }),
  );
  console.log(`characters.json: ${characters.length} nikkes`);

  // --- per-character detail files from roledata ---
  const DETAILS = path.join(OUT, "details");
  await mkdir(DETAILS, { recursive: true });
  let detailCount = 0;
  for (const n of characters) {
    const detail = await buildDetail(n.resourceId);
    if (detail) {
      await writeFile(path.join(DETAILS, `${n.id}.json`), JSON.stringify(detail));
      detailCount++;
    }
  }
  console.log(`details/: ${detailCount} character detail files`);

  // --- copy remaining tables verbatim ---
  const rawFiles = await readdir(RAW);
  const skip = (f: string) =>
    f.startsWith("nikke_list_") ||
    f.startsWith("roledata_") ||
    /^scene_(d_|event_)/.test(f) ||
    f.startsWith("attract_");
  let copied = 0;
  for (const f of rawFiles) {
    if (skip(f)) continue;
    await copyFile(path.join(RAW, f), path.join(OUT, "tables", f));
    copied++;
  }
  console.log(`tables: ${copied} files -> data/dist/tables/`);

  // --- normalize ko scene dialogue files ---
  const SCENES = path.join(OUT, "scenes");
  await mkdir(SCENES, { recursive: true });
  // attractive scenario metadata: gid -> { title, level, nikke }
  const attractMeta = new Map<string, { title?: string; level?: number; nikke?: string }>();
  for (const f of rawFiles.filter((f) => f.startsWith("roledata_") && f.endsWith("_ko.json"))) {
    const r = JSON.parse(await readFile(path.join(RAW, f), "utf8"));
    for (const s of r.attractive_scenario_list ?? []) {
      const gid: string | undefined = s.attractive_scenario_group_id;
      if (gid) {
        attractMeta.set(gid, {
          title: s.scenario_title_locale,
          level: s.attractive_level,
          nikke: r.name_localkey,
        });
      }
    }
  }

  const sceneIndex: {
    groupId: string;
    name?: string;
    lines: number;
    type?: string;
    nikke?: string;
    level?: number;
  }[] = [];
  for (const f of rawFiles.filter((f) => /^scene_(d_|event_)/.test(f))) {
    const d = JSON.parse(await readFile(path.join(RAW, f), "utf8"));
    const gid = d.scenario_group_id?.value ?? f.replace(/^scene_|\.json$/g, "");
    const records = d.scenario_group_id?.records?.value ?? [];
    const lines = records.map((r: any) => ({
      id: r.value?.id,
      speaker: r.value?.speaker,
      speakerName: r.speaker?.name_localkey?.character_name ?? r.value?.speaker,
      text: r.quest_name,
      window: r.value?.speech_window,
    }));
    await writeFile(
      path.join(SCENES, `${gid}.json`),
      JSON.stringify({ id: d.id, groupId: gid, name: d.scene_name, lines }),
    );
    sceneIndex.push({ groupId: gid, name: d.scene_name, lines: lines.length });
  }

  // --- normalize ko attractive (호감도) dialogue files ---
  for (const f of rawFiles.filter((f) => f.startsWith("attract_") && f.endsWith(".json"))) {
    const d = JSON.parse(await readFile(path.join(RAW, f), "utf8"));
    const gid = f.replace(/^attract_|\.json$/g, "");
    const meta = attractMeta.get(gid);
    const records = Array.isArray(d.records) ? d.records : [];
    const lines = records.map((r: any) => ({
      id: r.id,
      speaker: r.speaker,
      speakerName: r.speaker_detail?.name_localkey ?? r.speaker,
      text: r.scenario_localkey,
      window: r.speech_window,
      background: r.set_background,
      bgm: r.play_bgm,
    }));
    await writeFile(
      path.join(SCENES, `${gid}.json`),
      JSON.stringify({
        groupId: gid,
        type: "attractive",
        name: meta?.title,
        nikke: meta?.nikke,
        attractiveLevel: meta?.level,
        lines,
      }),
    );
    sceneIndex.push({
      groupId: gid,
      name: meta?.title,
      lines: lines.length,
      type: "attractive",
      nikke: meta?.nikke,
      level: meta?.level,
    });
  }
  await writeFile(path.join(OUT, "scenes.json"), JSON.stringify(sceneIndex));
  console.log(`scenes/: ${sceneIndex.length} dialogue files (ko)`);
}

// strip <color=#...>, <word_group=NNN>..</..> etc, keep inner text
const stripMarkup = (s: string) => s.replace(/<\/?[a-z_]+[^>]*>/gi, "");

function renderDescription(template: string, values: Skill["values"], level: number): string {
  const rendered = template.replace(/\{description_value_(\d+)\}/g, (_, n) => {
    const slot = values[Number(n) - 1];
    return slot?.[level] ?? "";
  });
  return stripMarkup(rendered).trim();
}

function mergeSkill(
  slot: Skill["slot"],
  details: (RawRoleData | null)[],
  pick: (r: RawRoleData) => RawSkillDetail | undefined,
): Skill | null {
  const name: Skill["name"] = {};
  const descriptionTemplate: Skill["descriptionTemplate"] = {};
  const descriptions: Skill["descriptions"] = {};
  let id: number | undefined;
  let iconName: string | undefined;
  let cooltime: number[] | undefined;
  let values: Skill["values"] = [];
  LOCALES.forEach((locale, i) => {
    const r = details[i];
    const s = r ? pick(r) : undefined;
    if (!s) return;
    id ??= s.id;
    iconName ??= s.icon;
    const raw = s.skill_cooltime_list ?? (s.skill_cooltime != null ? [s.skill_cooltime] : undefined);
    cooltime ??= raw?.map((v) => v / 100);
    if (s.name_localkey) name[locale] = s.name_localkey;
    const v = s.description_value_list ?? [];
    if (v.length > values.length) {
      values = v.map((x) => x.description_value ?? null);
    }
    if (s.description_localkey) {
      descriptionTemplate[locale] = s.description_localkey;
      const vals = v.map((x) => x.description_value ?? null);
      const maxLv = Math.max(Math.max(...vals.map((x) => x?.length ?? 0)) - 1, 0);
      descriptions[locale] = renderDescription(s.description_localkey, vals, maxLv);
    }
  });
  if (!Object.keys(name).length && !id) return null;
  return { slot, id, icon: iconName ? skillIcon(iconName) : undefined, name, descriptionTemplate, descriptions, cooltime, values };
}

async function buildDetail(resourceId: number): Promise<NikkeDetail | null> {
  const roles = await Promise.all(
    LOCALES.map((l) => readJson<RawRoleData>(`roledata_${resourceId}_${l}.json`)),
  );
  const first = roles.find(Boolean);
  if (!first) return null;

  const backstory: NikkeDetail["backstory"] = {};
  const squadName: Partial<Record<Locale, string>> = {};
  const squadDesc: Partial<Record<Locale, string>> = {};
  roles.forEach((r, i) => {
    if (!r) return;
    const l = LOCALES[i];
    if (r.description_localkey) backstory[l] = r.description_localkey;
    if (r.squad_detail?.squad_name) squadName[l] = r.squad_detail.squad_name;
    if (r.squad_detail?.squad_description) squadDesc[l] = r.squad_detail.squad_description;
  });

  const skills = [
    mergeSkill("skill1", roles, (r) => r.skill1_detail),
    mergeSkill("skill2", roles, (r) => r.skill2_detail),
    mergeSkill("burst", roles, (r) => r.ulti_skill_detail),
  ].filter((s): s is Skill => s !== null);

  return {
    backstory,
    squad: first.squad_detail
      ? {
          id: first.squad_detail.id,
          key: first.squad_detail.squad,
          iconResource: first.squad_detail.resource_id,
          name: squadName,
          description: squadDesc,
        }
      : undefined,
    cv: {
      ko: first.cv_localkey_ko || first.cv_localkey || undefined,
      ja: first.cv_localkey_ja || undefined,
      en: first.cv_localkey_en || undefined,
    },
    combat: {
      criticalRatio: first.critical_ratio != null ? `${first.critical_ratio / 100}%` : undefined,
      criticalDamage: first.critical_damage != null ? `${first.critical_damage / 100}%` : undefined,
      bonusRangeMin: first.bonusrange_min,
      bonusRangeMax: first.bonusrange_max,
      burstApplyDelay: first.burst_apply_delay != null ? first.burst_apply_delay / 100 : undefined,
      burstDuration: first.burst_duration != null ? first.burst_duration / 100 : undefined,
      changeBurstStep: first.change_burst_step,
    },
    skills,
    statsPerLevel: {
      attack: first.character_level_attack_list,
      defence: first.character_level_defence_list,
      hp: first.character_level_hp_list,
    },
    teammateList: first.teammate_list,
    attractiveScenarios: first.attractive_scenario_list,
  };
}

main();
