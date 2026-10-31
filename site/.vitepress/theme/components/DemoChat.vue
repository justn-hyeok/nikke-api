<script setup lang="ts">
import { onMounted, ref } from "vue";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: { sitekey: string; callback: (t: string) => void }
      ) => string;
      reset: (id: string) => void;
    };
  }
}

const DEMO_URL = import.meta.env.VITE_DEMO_URL as string | undefined;
const TURNSTILE_SITEKEY = import.meta.env.VITE_TURNSTILE_SITEKEY as
  | string
  | undefined;
const enabled = !!DEMO_URL;

interface ToolCall {
  name: string;
  args: object;
}
interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  tools?: ToolCall[];
}

const messages = ref<ChatMsg[]>([]);
const input = ref("");
const pending = ref(false);
const error = ref("");
const remaining = ref<number | null>(null);
const turnstileToken = ref("");
const turnstileEl = ref<HTMLElement | null>(null);
let turnstileWidgetId: string | null = null;

const examples = [
  "BUNNY X 777 이벤트 스토리 요약해줘",
  "메인 24챕터까지 깼는데 다음에 뭐 봐?",
  "라피랑 홍련 스킬 비교해줘",
];

const argsSummary = (args: object) => {
  const s = JSON.stringify(args);
  return s.length > 60 ? `${s.slice(0, 60)}…` : s;
};

onMounted(() => {
  if (!enabled || !TURNSTILE_SITEKEY) return;
  const s = document.createElement("script");
  s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
  s.async = true;
  s.defer = true;
  s.onload = () => {
    if (turnstileEl.value && window.turnstile) {
      turnstileWidgetId = window.turnstile.render(turnstileEl.value, {
        sitekey: TURNSTILE_SITEKEY,
        callback: (t: string) => (turnstileToken.value = t),
      });
    }
  };
  document.head.appendChild(s);
});

const resetTurnstile = () => {
  if (turnstileWidgetId != null && window.turnstile) {
    window.turnstile.reset(turnstileWidgetId);
    turnstileToken.value = "";
  }
};

const send = async () => {
  const content = input.value.trim().slice(0, 300);
  if (!content || pending.value) return;
  error.value = "";
  messages.value.push({ role: "user", content });
  input.value = "";
  pending.value = true;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const body: Record<string, unknown> = {
      messages: messages.value
        .slice(-6)
        .map(({ role, content: c }) => ({ role, content: c })),
    };
    if (turnstileToken.value) body.turnstileToken = turnstileToken.value;
    const res = await fetch(`${DEMO_URL}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 429) {
      const wait = typeof data?.retryAfter === "number" ? data.retryAfter : 60;
      error.value = `요청이 많아요. ${wait}초 후에 다시 시도해 주세요`;
    } else if (res.status === 503) {
      error.value = "체험이 잠시 꺼져 있어요";
    } else if (!res.ok) {
      error.value =
        typeof data?.error === "string" ? data.error : "오류가 발생했어요";
    } else {
      messages.value.push({
        role: "assistant",
        content: typeof data?.reply === "string" ? data.reply : "",
        tools: Array.isArray(data?.tools) ? data.tools : [],
      });
      if (typeof data?.remainingToday === "number") {
        remaining.value = data.remainingToday;
      }
    }
  } catch {
    error.value = ctrl.signal.aborted
      ? "응답이 너무 오래 걸려요. 다시 시도해 주세요"
      : "연결에 실패했어요. 잠시 후 다시 시도해 주세요";
  } finally {
    clearTimeout(timer);
    pending.value = false;
    resetTurnstile();
  }
};
</script>

<template>
  <div v-if="enabled" class="home-section">
    <h2 id="ai-demo" tabindex="-1">AI로 미리 써보기</h2>
    <div class="demo-chat">
    <div class="chat-log">
      <p v-if="!messages.length" class="chat-empty">
        MCP 도구를 쓰는 AI에게 바로 물어볼 수 있어요.
      </p>
      <div
        v-for="(m, i) in messages"
        :key="i"
        class="chat-msg"
        :class="m.role"
      >
        <p class="chat-text">{{ m.content }}</p>
        <div v-if="m.tools?.length" class="tool-chips">
          <span
            v-for="(t, j) in m.tools"
            :key="j"
            class="tool-chip"
            :title="argsSummary(t.args)"
          >
            {{ t.name }} {{ argsSummary(t.args) }}
          </span>
        </div>
      </div>
      <p v-if="pending" class="chat-empty">답변을 기다리는 중…</p>
    </div>

    <p v-if="error" class="chat-error">{{ error }}</p>

    <div class="chat-examples">
      <button
        v-for="e in examples"
        :key="e"
        type="button"
        class="example-chip"
        @click="input = e"
      >
        {{ e }}
      </button>
    </div>

    <form class="chat-input" @submit.prevent="send">
      <input
        v-model="input"
        type="text"
        maxlength="300"
        placeholder="질문을 입력하세요 (최대 300자)"
        :disabled="pending"
      />
      <button type="submit" :disabled="pending || !input.trim()">
        {{ pending ? "전송 중…" : "보내기" }}
      </button>
    </form>

    <div v-if="TURNSTILE_SITEKEY" ref="turnstileEl" class="chat-turnstile"></div>

    <p class="chat-notice">
      DeepSeek로 동작하는 체험판이에요 · 이용 횟수가 제한돼요 · 입력 내용은
      저장하지 않아요
      <span v-if="remaining !== null">· 오늘 남은 횟수 {{ remaining }}회</span>
    </p>
    </div>
  </div>
</template>

<style scoped>
.demo-chat {
  margin: 16px 0;
  padding: 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.chat-log {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 420px;
  overflow-y: auto;
}
.chat-empty {
  margin: 0;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.chat-msg .chat-text {
  margin: 0;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
}
.chat-msg.user .chat-text {
  background: var(--vp-c-brand-soft);
  border: 1px solid var(--vp-c-brand-1);
}
.chat-msg.assistant .chat-text {
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
}
.tool-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
.tool-chip {
  font-size: 11px;
  font-family: var(--vp-font-family-mono);
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-2);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chat-error {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--vp-c-brand-1);
}
.chat-examples {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}
.example-chip {
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  cursor: pointer;
}
.example-chip:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.chat-input {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
.chat-input input {
  flex: 1;
  min-width: 0;
  padding: 10px 14px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 14px;
}
.chat-input button {
  flex-shrink: 0;
  padding: 10px 18px;
  border-radius: 8px;
  border: none;
  background: var(--vp-c-brand-1);
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}
.chat-input button:disabled {
  opacity: 0.5;
  cursor: default;
}
.chat-turnstile {
  margin-top: 12px;
}
.chat-notice {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--vp-c-text-2);
}
</style>
