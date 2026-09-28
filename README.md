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

## API 문서

**요청/응답 형식 전체 문서 → [API.md](API.md)**

## 문의

문의나 요청사항은 **leegunwoo0325@gmail.com**으로 보내주시거나 **[Issues](https://github.com/leegunwoooo/nikke-api/issues)** 기능을 활용해주시면 감사하겠습니다.
