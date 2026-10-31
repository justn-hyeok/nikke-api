<script setup lang="ts">
import { onMounted, ref } from "vue";
import { API_BASE as BASE } from "../api-base";

interface NextEntry {
  kind: string;
  title: string;
  required: boolean;
  importance?: string;
  note?: string;
}

const chapter = ref<number>(20);
const entries = ref<NextEntry[]>([]);
const failed = ref(false);
const loading = ref(false);

const importanceLabel: Record<string, string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};

const load = async () => {
  const n = Number(chapter.value);
  if (!Number.isInteger(n) || n < -1 || n > 50) {
    entries.value = [];
    failed.value = true;
    return;
  }
  loading.value = true;
  failed.value = false;
  try {
    const res = await fetch(`${BASE}/api/story/next?chapter=${n}&limit=6`);
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    if (!Array.isArray(data?.next)) throw new Error("no next");
    entries.value = data.next;
  } catch {
    entries.value = [];
    failed.value = true;
  } finally {
    loading.value = false;
  }
};

onMounted(load);
</script>

<template>
  <div class="story-next">
    <div class="story-next-controls">
      <label>
        마지막으로 끝낸 메인 챕터
        <input
          v-model.number="chapter"
          type="number"
          min="-1"
          max="50"
          @change="load"
        />
      </label>
      <span class="hint">0–50, -1이면 처음부터</span>
      <button type="button" :disabled="loading" @click="load">
        {{ loading ? "불러오는 중…" : "추천받기" }}
      </button>
    </div>

    <p v-if="failed" class="story-next-fallback">지금은 불러올 수 없어요</p>

    <ol v-else-if="entries.length" class="story-next-list">
      <li v-for="(e, i) in entries" :key="i">
        <span class="entry-title">{{ e.title }}</span>
        <span class="badge" :class="{ optional: !e.required }">
          {{ e.required ? "필수" : "선택" }}
        </span>
        <span v-if="e.importance" class="importance">
          중요도 {{ importanceLabel[e.importance] ?? e.importance }}
        </span>
        <span v-if="e.note" class="entry-note">{{ e.note }}</span>
      </li>
    </ol>

    <p class="story-next-credit">
      순서 출처:
      <a href="https://ssissun.github.io/nikke-storyline/" target="_blank" rel="noopener">
        NIKKE 스토리 감상 순서 가이드 (ssissun)
      </a>
    </p>
  </div>
</template>

<style scoped>
.story-next {
  margin: 16px 0;
  padding: 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.story-next-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.story-next-controls label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}
.story-next-controls input {
  width: 72px;
  padding: 6px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 14px;
}
.story-next-controls .hint {
  font-size: 12px;
  color: var(--vp-c-text-2);
}
.story-next-controls button {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-brand-1);
  background: transparent;
  color: var(--vp-c-brand-1);
  font-size: 13px;
  cursor: pointer;
}
.story-next-controls button:disabled {
  opacity: 0.6;
  cursor: default;
}
.story-next-fallback {
  margin: 16px 0 0;
  color: var(--vp-c-text-2);
  font-size: 14px;
}
.story-next-list {
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  counter-reset: next;
}
.story-next-list li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  counter-increment: next;
}
.story-next-list li::before {
  content: counter(next) ".";
  color: var(--vp-c-brand-1);
  font-weight: 600;
  font-size: 14px;
}
.entry-title {
  font-size: 14px;
  font-weight: 600;
}
.badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}
.badge.optional {
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  border: 1px solid var(--vp-c-divider);
}
.importance {
  font-size: 11px;
  color: var(--vp-c-text-2);
}
.entry-note {
  flex-basis: 100%;
  font-size: 12px;
  color: var(--vp-c-text-2);
  padding-left: 16px;
}
.story-next-credit {
  margin: 16px 0 0;
  font-size: 12px;
  color: var(--vp-c-text-2);
}
</style>
