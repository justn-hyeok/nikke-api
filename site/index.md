---
layout: home

hero:
  name: nikke-api
  text: 비공식 NIKKE 데이터 API + MCP 서버
  tagline: 승리의 여신 니케의 캐릭터·스토리·소장품 데이터를 REST API와 MCP로 제공합니다.
  actions:
    - theme: brand
      text: MCP 연결
      link: /mcp
    - theme: alt
      text: API 레퍼런스
      link: /api
---

AI 클라이언트에 바로 연결할 수 있는 공식 MCP 엔드포인트입니다.

<McpUrl />

<LiveStats />

<div class="home-section">

## 이렇게 물어보세요

연결한 AI 클라이언트에 그대로 입력하면 됩니다.

<div class="prompt-cards">
  <div class="prompt-card">
    <p>"BUNNY X 777 이벤트 스토리 요약해줘"</p>
    <span>read_event</span>
  </div>
  <div class="prompt-card">
    <p>"메인 24챕터까지 깼는데 다음에 뭐 봐?"</p>
    <span>next_story</span>
  </div>
  <div class="prompt-card">
    <p>"라피랑 홍련 스킬 비교해줘"</p>
    <span>compare_nikkes</span>
  </div>
  <div class="prompt-card">
    <p>"아니스가 제일 많이 나오는 이벤트는?"</p>
    <span>nikke_appearances</span>
  </div>
  <div class="prompt-card">
    <p>"'방주의 영웅'이라는 대사 나온 장면 찾아줘"</p>
    <span>search_lines</span>
  </div>
  <div class="prompt-card">
    <p>"철갑 속성 버스트 3 화력형 니케 알려줘"</p>
    <span>search_nikkes</span>
  </div>
</div>

</div>

<div class="home-section">

## 다음 스토리 추천 체험

<StoryNext />

</div>

<DemoChat />

<div class="home-section">

## 주요 기능

<div class="feature-list">

<div class="feature-item">

**스토리 감상 순서·다음 스토리 추천**

메인 챕터 사이에 이벤트·사이드·호감도 스토리를 배치한 커뮤니티 추천 순서로, 지금 진행 위치에서 다음에 볼 스토리를 알려줍니다. — [API 레퍼런스](/api)

</div>

<div class="feature-item">

**대사 검색·등장 씬**

대사 본문·화자로 전체 스토리를 검색하고, 캐릭터가 나오는 씬과 이벤트를 대사 수 순으로 찾습니다. — [MCP 연결](/mcp)

</div>

<div class="feature-item">

**이격(원본·다른 버전) 연결**

같은 캐릭터의 다른 버전을 하나로 묶어 검색·대사·등장 씬까지 함께 찾습니다. — [MCP 연결](/mcp)

</div>

</div>

</div>

<div class="home-section">

## 3단계로 연결

<div class="steps-grid">

<div class="steps-col">

**ChatGPT**

1. 설정 → 앱 및 커넥터 → 고급 설정에서 개발자 모드를 켭니다.
2. 커넥터 화면에서 만들기를 누르고 URL에 <McpUrlInline />를 넣습니다.
3. 새 대화에서 개발자 모드로 이 커넥터를 켜고 질문합니다.

</div>

<div class="steps-col">

**Claude**

1. 설정 → 커넥터에서 커스텀 커넥터 추가를 누릅니다.
2. 이름을 정하고 URL에 <McpUrlInline />를 넣습니다.
3. 대화 입력창의 + 메뉴에서 커넥터를 켜고 질문합니다.

</div>

</div>

자세한 방법과 다른 클라이언트는 [MCP 연결 가이드](/mcp)를 보세요.

</div>

> **저작권 고지** — 본 프로젝트는 **비공식·비상업적 팬 프로젝트**입니다. 제공되는 모든 게임 데이터의 저작권은 **© SHIFT UP / Level Infinite**에 있으며, SHIFT UP 및 Level Infinite와 아무런 관련이 없습니다. 데이터는 공개된 [BlablaLink](https://www.blablalink.com) CDN 리소스를 그대로 참조합니다.
