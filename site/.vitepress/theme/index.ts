import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import McpUrl from "./components/McpUrl.vue";
import LiveStats from "./components/LiveStats.vue";
import ApiReference from "./components/ApiReference.vue";
import "./custom.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("McpUrl", McpUrl);
    app.component("LiveStats", LiveStats);
    app.component("ApiReference", ApiReference);
  },
} satisfies Theme;
