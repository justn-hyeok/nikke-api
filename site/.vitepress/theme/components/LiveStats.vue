<script setup lang="ts">
import { onMounted, ref } from "vue";
import { API_BASE as BASE } from "../api-base";

interface Stats {
  version: string;
  syncedAt: string;
  nikkes: number;
  scenes: number;
  events: number;
}

const stats = ref<Stats | null>(null);

const formatDate = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const get = async (p: string) => {
  const res = await fetch(`${BASE}${p}`);
  if (!res.ok) throw new Error(p);
  return res.json();
};

onMounted(async () => {
  try {
    const [meta, nikkes, scenes, events] = await Promise.all([
      get("/"),
      get("/api/nikkes?limit=1"),
      get("/api/scenes?limit=1"),
      get("/api/events?limit=1"),
    ]);
    stats.value = {
      version: meta.version ?? "?",
      syncedAt: meta.syncedAt ? formatDate(new Date(meta.syncedAt)) : "?",
      nikkes: nikkes.count ?? 0,
      scenes: scenes.count ?? 0,
      events: events.count ?? 0,
    };
  } catch {
    stats.value = null;
  }
});
</script>

<template>
  <div v-if="stats" class="live-stats">
    <div class="stat"><b>{{ stats.nikkes.toLocaleString() }}</b><span>캐릭터</span></div>
    <div class="stat"><b>{{ stats.scenes.toLocaleString() }}</b><span>스토리 씬</span></div>
    <div class="stat"><b>{{ stats.events.toLocaleString() }}</b><span>이벤트</span></div>
    <div class="stat"><b>v{{ stats.version }}</b><span>API 버전</span></div>
    <div class="stat"><b>{{ stats.syncedAt }}</b><span>데이터 동기화</span></div>
  </div>
</template>
