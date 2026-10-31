<script setup lang="ts">
import { ref } from "vue";

const url = "https://nikke-api-edge.leegunwoo0325-5e6.workers.dev/mcp";
const copied = ref(false);

const copy = async () => {
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    const el = document.createElement("textarea");
    el.value = url;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    el.remove();
  }
  copied.value = true;
  setTimeout(() => (copied.value = false), 1500);
};
</script>

<template>
  <div class="mcp-url">
    <code>{{ url }}</code>
    <button type="button" @click="copy">{{ copied ? "복사됨" : "복사" }}</button>
  </div>
</template>
