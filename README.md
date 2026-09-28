# nikke-data-api

> [!WARNING]
> **저작권 고지 — 반드시 읽어주세요**
>
> 본 프로젝트는 **비공식·비상업적 팬 프로젝트**입니다. 이 API를 통해 제공되는 모든 게임 데이터, 캐릭터 정보, 이미지, 텍스트 등 콘텐츠의 저작권 및 지적재산권은 **© SHIFT UP / Level Infinite**에 있습니다.
>
> 본 프로젝트는 SHIFT UP 및 Level Infinite와 아무런 관련이 없으며, 공인·후원·승인받은 서비스가 아닙니다. 데이터는 공개된 [BlablaLink](https://www.blablalink.com) CDN 리소스를 그대로 참조하여 제공하며, 재호스팅·수정하지 않습니다.
>
> 상업적 이용을 금지하며, 권리자의 요청이 있을 경우 즉시 서비스를 중단합니다.

---

## 소개

승리의 여신: 니케(GODDESS OF VICTORY: NIKKE) 캐릭터 데이터를 제공하는 REST API입니다.

BlablaLink(공식 위키 도구)의 CDN 데이터를 주기적으로 동기화하여 항상 최신 캐릭터 정보를 제공합니다.

- **캐릭터 202종** 전체 수록 (기본 정보 + 스킬/스탯/배경 상세)
- **4개 언어** 지원: 한국어 `ko` / 영어 `en` / 일본어 `ja` / 중국어 번체 `zh-TW`
- 스킬 설명은 **Lv10(최대 레벨) 기준**으로 렌더링된 텍스트 제공 (원본 템플릿·레벨별 수치도 포함)
- 이미지는 BlablaLink CDN URL로 제공 (직접 재호스팅하지 않음)

**라이브 주소**: https://nikke-api-gunwoos-projects.vercel.app

## 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/nikkes` | 캐릭터 목록 (경량) — 쿼리: `q`, `element`, `class`, `burst`, `corporation`, `weapon`, `rarity` |
| GET | `/api/nikkes/:id` | 캐릭터 상세 — `id`는 캐릭터 ID, `resourceId`, 또는 이름(부분 일치) 가능 |
| GET | `/api/meta/filters` | 사용 가능한 필터 값 목록 |
| GET | `/api/tables` | 동기화된 원본 테이블 파일 목록 |
| GET | `/api/tables/:file` | 원본 테이블 JSON |
| GET | `/api/cdn?path=` | BlablaLink CDN 리소스 경로 → URL 변환 |

### 예시

```bash
# 이름에 "아니스"가 포함된 모든 캐릭터 (부분 일치)
curl "https://nikke-api-gunwoos-projects.vercel.app/api/nikkes?q=아니스"

# 상세 조회 — ID(301201), resourceId(12), 이름 모두 가능
curl "https://nikke-api-gunwoos-projects.vercel.app/api/nikkes/301201"

# 속성 + 레어도 필터
curl "https://nikke-api-gunwoos-projects.vercel.app/api/nikkes?element=Electronic&rarity=SSR"
```

### 응답 구조

목록 응답은 경량입니다. 상세(`/api/nikkes/:id`)에서만 `details`가 붙습니다:

```
details: {
  backstory,           // 캐릭터 배경 스토리 (4개 언어)
  squad, cv,           // 스쿼드, 성우
  combat,              // 전투 관련 메타데이터
  skills[],            // 스킬: name, descriptionTemplate(원본), descriptions(Lv10), values(레벨별 원본 수치), cooltime
  statsPerLevel,       // 레벨별 스탯
  teammateList,
  attractiveScenarios  // 호감도 시나리오 목록
}
```

## 로컬 실행

```bash
npm install
npm run sync      # CDN → data/raw 동기화
npm run build     # data/dist 생성 (characters.json, details/, tables/)
npm run dev       # 로컬 서버 (tsx watch)
```

타입체크: `npm run typecheck`

## 데이터 갱신

- 데이터(`data/`)는 Git에 커밋하지 않고 **배포 시 CDN에서 다시 받아옵니다**.
- GitHub Actions(`.github/workflows/refresh-data.yml`)가 매일 Vercel Deploy Hook을 호출해 재배포 → 최신 데이터 반영.
- 설정: Vercel Deploy Hook URL을 레포 Secret `VERCEL_DEPLOY_HOOK_URL`에 등록.

## 기술 스택

TypeScript · Hono · @hono/node-server · Vercel Serverless · esbuild (배포용 트랜스파일)

## 라이선스

- **코드**: 자유롭게 사용 가능
- **데이터/이미지**: 모든 권리는 **© SHIFT UP / Level Infinite**에 있습니다. 본 API는 데이터의 소유권을 주장하지 않으며, 사용 시 발생하는 법적 책임은 사용자에게 있습니다.
