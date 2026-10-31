import { defineConfig } from "vitepress";

export default defineConfig({
  lang: "ko-KR",
  title: "nikke-api",
  description: "비공식 NIKKE 데이터 REST API + MCP 서버",
  base: "/nikke-api/",
  appearance: "dark",
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: "홈", link: "/" },
      { text: "MCP 연결", link: "/mcp" },
      { text: "API 레퍼런스", link: "/api" },
      {
        text: "GitHub",
        link: "https://github.com/leegunwoooo/nikke-api",
      },
    ],
    sidebar: [
      { text: "홈", link: "/" },
      { text: "MCP 연결", link: "/mcp" },
      { text: "API 레퍼런스", link: "/api" },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/leegunwoooo/nikke-api" },
    ],
    outline: { label: "이 페이지" },
    docFooter: { prev: "이전", next: "다음" },
    darkModeSwitchLabel: "테마",
    sidebarMenuLabel: "메뉴",
    returnToTopLabel: "맨 위로",
    search: {
      provider: "local",
      options: {
        locales: {
          root: {
            translations: {
              button: { buttonText: "검색", buttonAriaLabel: "검색" },
              modal: {
                noResultsText: "결과를 찾을 수 없습니다",
                resetButtonTitle: "검색 초기화",
                backButtonTitle: "닫기",
                displayDetails: "자세한 목록 표시",
                footer: {
                  selectText: "선택",
                  navigateText: "이동",
                  closeText: "닫기",
                },
              },
            },
          },
        },
      },
    },
  },
});
