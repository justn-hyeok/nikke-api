# API 문서

베이스 URL: `https://nikke-api-gunwoos-projects.vercel.app`

모든 응답은 `application/json`. 캐릭터 이름은 4개 언어(`ko`, `en`, `ja`, `zh-TW`)로 제공되며, 검색은 모든 언어에 대해 부분 일치로 동작합니다.

> [!WARNING]
> 본 문서의 모든 데이터는 **© SHIFT UP / Level Infinite** 소유이며, 비공식·비상업적 용도로만 제공됩니다.

---

## 목차

- [GET /api/nikkes](#get-apinikkes) — 캐릭터 목록
- [GET /api/nikkes/:id](#get-apinikkesid) — 캐릭터 상세
- [GET /api/meta/filters](#get-apimetafilters) — 필터 값 목록
- [GET /api/tables](#get-apitables) — 원본 테이블 목록
- [GET /api/tables/:file](#get-apitablesfile) — 원본 테이블 조회
- [GET /api/scenes](#get-apiscenes) — 스토리 씬 목록 (한국어)
- [GET /api/scenes/:groupId](#get-apiscenesgroupid) — 씬 대본 (한국어)
- [GET /api/cdn](#get-apicdn) — CDN 경로 → URL 변환
- [에러 응답](#에러-응답)

---

## GET /api/nikkes

캐릭터 목록을 반환합니다. 응답은 경량이며 `details` 필드는 포함되지 않습니다.

### 쿼리 파라미터

| 파라미터 | 설명 | 예시 |
|----------|------|------|
| `q` | 이름 부분 일치 검색 (전 언어 대상) | `?q=아니스` |
| `element` | 속성 | `Electronic`, `Iron`, `Fire`, `Wind`, `Water` |
| `class` | 클래스 | `Attacker`, `Defender`, `Supporter` |
| `burst` | 버스트 스텝 | `I`, `II`, `III`, `All` |
| `corporation` | 소속 | `MISSILIS`, `ELYSION`, `TETRA`, `PILGRIM`, `ABNORMAL` |
| `weapon` | 무기 종류 | `RL`, `SMG`, `SG`, `SR`, `AR`, `MG` |
| `rarity` | 레어도 | `SSR`, `SR`, `R` |

모든 필터는 AND로 결합되며 대소문자를 구분하지 않습니다.

### 요청 예시

```
GET /api/nikkes?q=아니스
GET /api/nikkes?element=Electronic&rarity=SSR
```

### 응답

```json
{
  "count": 3,
  "characters": [
    {
      "id": 301201,
      "resourceId": 12,
      "name": { "ko": "아니스", "en": "Anis", "ja": "アニス", "zh-TW": "阿妮斯" },
      "rarity": "SR",
      "class": "Defender",
      "burst": "II",
      "corporation": "TETRA",
      "element": "Iron",
      "weapon": { "type": "RL", "attackType": "Metal", "ammo": 6 },
      "costumes": [],
      "images": {
        "icon": "https://sg-tools-cdn.blablalink.com/.../xxx.webp",
        "medium": "https://sg-tools-cdn.blablalink.com/.../xxx.webp",
        "full": "https://sg-tools-cdn.blablalink.com/.../xxx.webp"
      },
      "icons": {
        "grade": "...",
        "class": "...",
        "element": "..."
      },
      "skillIcons": {
        "skill1": "...",
        "skill2": "...",
        "burst": "..."
      }
    }
  ]
}
```

### 필드 설명

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | number | 캐릭터 ID |
| `resourceId` | number | 내부 리소스 ID (CDN roledata 파일명에 사용) |
| `name` | object | `{ko, en, ja, zh-TW}` 로컬라이즈된 이름 |
| `weapon.attackType` | string | 내부 공격 타입 (`Metal`, `Energy`, `Bio`) — 공식 UI 미표시 값 |
| `images` | object | `icon` / `medium` / `full` 이미지 (BlablaLink CDN URL) |
| `skillIcons` | object | 스킬별 아이콘 URL |

---

## GET /api/nikkes/:id

캐릭터 상세 정보를 반환합니다. 목록 필드 전체 + `details` 포함.

`:id`에는 세 가지 형식이 가능합니다:

- 캐릭터 ID: `/api/nikkes/301201`
- resourceId: `/api/nikkes/12`
- 이름 (부분 일치): `/api/nikkes/아니스` — 복수 매칭 시 목록 형태로 반환 (단일 매칭 시에만 상세 반환)

### 응답 (상세 부분)

```json
{
  "id": 301201,
  "name": { "ko": "아니스", ... },
  "...": "목록 필드와 동일",
  "details": {
    "backstory": { "ko": "...", "en": "...", "ja": "...", "zh-TW": "..." },
    "squad": { ... },
    "cv": { "ko": "김성연", ... },
    "combat": {
      "criticalRatio": "15%",
      "criticalDamage": "150%",
      "bonusRangeMin": 0,
      "bonusRangeMax": 0,
      "burstApplyDelay": 0.01,
      "burstDuration": 10,
      "changeBurstStep": "Step3"
    },
    "skills": [
      {
        "slot": "skill1",
        "id": 1201,
        "icon": "https://...",
        "name": { "ko": "...", ... },
        "descriptionTemplate": { "ko": "{description_value_01} ... 원본 템플릿", ... },
        "descriptions": { "ko": "■ 40회 피격 시 자신에게\n[방어력 120% ▲] [10초 유지]", ... },
        "values": [ ["1레벨 값", ...], ..., ["10레벨 값", ...] ]
      }
    ],
    "statsPerLevel": {
      "attack": [360, 378, ..., "레벨1~최대"],
      "defence": [...],
      "hp": [...]
    },
    "teammateList": [ ... ],
    "attractiveScenarios": [ ... ]
  }
}
```

### `skills[]` 필드

| 필드 | 설명 |
|------|------|
| `slot` | `skill1` / `skill2` / `burst` |
| `descriptions` | **Lv10(최대 레벨) 기준 렌더링된 설명** — `{description_value_XX}` 플레이스홀더 치환 + 마크업 제거 완료 |
| `descriptionTemplate` | 원본 템플릿 (플레이스홀더 포함) |
| `values` | 레벨별 원본 수치 배열 (Lv1~Lv10) |
| `cooltime` | 버스트 쿨타임, 초 단위 |

### 복수 매칭 시

이름으로 조회 시 여러 캐릭터가 매칭되면 상세 없이 목록으로 반환됩니다:

```
GET /api/nikkes/아니스
```

```json
{ "count": 3, "characters": [ {"id":301201,...}, {"id":301501,...}, {"id":301701,...} ] }
```

---

## GET /api/meta/filters

`/api/nikkes` 필터에 사용 가능한 값 목록을 반환합니다.

```json
{
  "elements": ["Electronic","Iron","Fire","Wind","Water"],
  "classes": ["Attacker","Defender","Supporter"],
  "bursts": ["III","II","I","All"],
  "corporations": ["MISSILIS","ELYSION","TETRA","PILGRIM","ABNORMAL"],
  "weapons": ["RL","SMG","SG","SR","AR","MG"],
  "rarities": ["SSR","SR","R"]
}
```

---

## GET /api/tables

동기화된 원본 게임 테이블 JSON 파일 목록을 반환합니다 (레벨 테이블, 장비 옵션, 아카이브, 스토리 목록 등 30종).

```json
{ "files": ["CharacterLevelTable.json", "ItemEquipTable_ko.json", ...] }
```

## GET /api/tables/:file

원본 테이블 JSON을 그대로 반환합니다. 파일명은 `[A-Za-z0-9._-]+\.json` 형식만 허용됩니다.

```
GET /api/tables/CharacterLevelTable.json
```

## GET /api/scenes

스토리 씬 목록을 반환합니다 (한국어). 메인/이벤트/돌발 스토리 + **호감도(Attractive) 시나리오** 포함 — 약 3000개 그룹.

### 쿼리 파라미터

| 파라미터 | 설명 | 예시 |
|----------|------|------|
| `q` | 그룹 ID·씬 이름 부분 일치 | `?q=발신자` |
| `category` | 카테고리 필터 | `main` / `event` / `sudden` / `attractive` |
| `nikke` | 호감도 씬 대상 니케 이름 부분 일치 | `?nikke=아니스` |
| `limit` | 반환 개수 제한 (최대 500) | `?limit=50` |
| `offset` | 시작 위치 (페이지네이션) | `?offset=50` |

```
GET /api/scenes?category=attractive&nikke=아니스
GET /api/scenes?category=main&limit=20&offset=0
```

```json
{
  "count": 5,
  "offset": 0,
  "scenes": [
    {
      "groupId": "d_nikke_anis_01",
      "name": "방주 나들이",
      "lines": 128,
      "category": "attractive",
      "type": "attractive",
      "nikke": "아니스",
      "level": 1
    }
  ]
}
```

| 필드 | 설명 |
|------|------|
| `groupId` | 시나리오 그룹 ID (`d_main_*` 메인, `event_*` 이벤트, `d_ex_*` 돌발, `d_nikke_*` 호감도) |
| `name` | 씬 이름 (한국어) |
| `lines` | 대사 수 |
| `category` | `main` / `event` / `sudden` / `attractive` / `etc` |
| `type` | `"attractive"`이면 호감도 시나리오 (일반 스토리는 없음) |
| `nikke` | 호감도 시나리오 대상 니케 (호감도만) |
| `level` | 필요 호감도 레벨 (호감도만) |

## GET /api/scenes/:groupId

해당 씬의 대본을 반환합니다 (한국어).

```
GET /api/scenes/d_main_01_01_s
```

```json
{
  "id": 1,
  "groupId": "d_main_01_01_s",
  "name": "첫 번째 접촉 : A",
  "lines": [
    {
      "id": "d_main_01_01_s_1",
      "speaker": "marian",
      "speakerName": "마리안",
      "text": "BA-01다운!\nBA-01다운!",
      "window": "Speech"
    }
  ]
}
```

| 필드 | 설명 |
|------|------|
| `lines[].speaker` | 화자 코드 (내부 식별자) |
| `lines[].speakerName` | 화자 이름 (한국어, 내레이션 등은 코드 그대로일 수 있음) |
| `lines[].text` | 대사 텍스트 |
| `lines[].window` | 말풍선 타입 (`Speech`, `Choice`, `Narration` 등) |
| `lines[].background` / `lines[].bgm` | 배경·BGM 리소스 코드 (호감도 씬에만 존재) |

호감도 씬(`groupId`가 `d_nikke_*`)은 상단에 `type: "attractive"`, `nikke`, `attractiveLevel` 필드가 추가로 붙습니다.

캐릭터별 호감도 씬은 `/api/nikkes/:id` 상세의 `details.attractiveScenarios`에 들어있는 `attractive_scenario_group_id`로 연결됩니다. 스킨 캐릭터(예: `아니스 : 스타`)는 자기 전용 그룹(`d_nikke_anis_star_*`)을 가지며, `?nikke=` 필터는 부분 일치라 `아니스`로 검색하면 모든 스킨 버전이 함께 나옵니다.

## GET /api/cdn

BlablaLink CDN 리소스 경로를 실제 URL로 변환합니다.

```
GET /api/cdn?path=character/ko/nikke_list_v2.json
```

```json
{
  "path": "character/ko/nikke_list_v2.json",
  "url": "https://sg-tools-cdn.blablalink.com/wi-97/ni-77/ffc69c4074f27bc772acbe869127e616.json"
}
```

`path`에 `..`가 포함되면 400.

---

## 에러 응답

| 상황 | 상태 | 본문 |
|------|------|------|
| 캐릭터 없음 | 404 | `{"error": "not found"}` |
| 잘못된 파일명/파라미터 | 400 | `{"error": "invalid file"}` / `{"error": "path required"}` |
