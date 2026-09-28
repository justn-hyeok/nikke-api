# nikke-api

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

승리의 여신: 니케(GODDESS OF VICTORY: NIKKE) 게임 데이터를 제공하는 REST API입니다.

BlablaLink(공식 위키 도구)의 CDN 데이터를 매일 동기화합니다. 데이터 변경이 감지될 때만 자동 재배포되어 항상 최신 상태를 유지합니다.

- **캐릭터 202종** — 기본 정보 + 스킬/스탯/배경/코스튬 상세
- **스토리 대본 3079개** — 메인/이벤트/돌발/호감도 씬, 화자 아이콘·보이스 포함 (한국어)
- **소장품 33종** — 레벨별 스탯·스킬 상세
- **원본 테이블** — 레벨/스테이지/타워/장비 등 게임 데이터 테이블
- **4개 언어** 지원: 한국어 `ko` / 영어 `en` / 일본어 `ja` / 중국어 번체 `zh-TW`
- 스킬 설명은 **Lv10(최대 레벨) 기준**으로 렌더링된 텍스트 제공 (원본 템플릿·레벨별 수치도 포함)
- 이미지·음성은 BlablaLink CDN URL로 제공 (직접 재호스팅하지 않음)

**라이브 주소**: https://nikke-api-gunwoos-projects.vercel.app

## 엔드포인트 요약

| 엔드포인트 | 설명 |
|------------|------|
| `GET /api/nikkes` | 캐릭터 목록 (이름 검색, 속성/클래스/버스트/기업/무기/레어 필터) |
| `GET /api/nikkes/:id` | 캐릭터 상세 — 스킬, 레벨별 스탯, 배경 스토리, 스쿼드, CV, 호감도 씬 |
| `GET /api/scenes` | 씬 목록 — `?category=` `?nikke=` `?q=` `?limit=` `?offset=` |
| `GET /api/scenes/:groupId` | 씬 대본 — 대사별 화자/아이콘/보이스 |
| `GET /api/favorites` | 소장품 목록 — `?q=` `?rare=` |
| `GET /api/favorites/:id` | 소장품 상세 — 레벨별 스탯, 컬렉션·전용 스킬 |
| `GET /api/tables` / `GET /api/tables/:file` | 원본 테이블 목록/조회 |
| `GET /api/meta/filters` | 사용 가능한 필터 값 목록 |
| `GET /api/cdn?path=` | CDN 리소스 경로 → URL 변환 |

공통으로 `?fields=id,name.ko`처럼 필요한 필드만 골라 받을 수 있고, 응답에는 `Cache-Control`/`ETag`가 붙습니다.

## API 문서

**요청/응답 형식 전체 문서 → [API.md](API.md)**

## 문의

문의나 요청사항은 **leegunwoo0325@gmail.com**으로 보내주시거나 **[Issues](https://github.com/leegunwoooo/nikke-api/issues)** 기능을 활용해주시면 감사하겠습니다.
