<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Sidebar from './components/sidebar/Sidebar.vue';

const healthStatus = ref<string>('checking...');
const runtimeInfo = ref<string>('');

onMounted(async () => {
  if (window.council) {
    try {
      const health = await window.council.healthCheck();
      healthStatus.value = health.ok ? 'connected' : 'error';
      runtimeInfo.value = `${health.runtime} v${health.version}`;
    } catch (e) {
      healthStatus.value = 'error';
      runtimeInfo.value = String(e);
    }
  } else {
    healthStatus.value = 'web-only';
    runtimeInfo.value = 'Running in browser (no Electron bridge)';
  }
});
</script>

<template>
  <div class="app-layout" data-testid="app-layout">
    <Sidebar />
    <main class="main-content" data-testid="main-content">
      <div class="placeholder" data-testid="main-placeholder">
        <p>LazyLLM - Multi-LLM Interface</p>
        <p class="hint" data-testid="placeholder-hint">
          Status: {{ healthStatus }}
        </p>
        <p class="hint" v-if="runtimeInfo">{{ runtimeInfo }}</p>
      </div>
    </main>
  </div>
</template>

<style>
:root {
  --bg: #ffffff;
  --bg-hover: #f3f4f6;
  --border: #e5e7eb;
  --text: #1f2937;
  --text-muted: #6b7280;
  --accent: #000000;
  --broadcast: #d7827e;
  --font-sans: 'SF Pro Text', 'SF Pro SC', 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei UI', 'Microsoft YaHei', 'Noto Sans CJK SC',
    'Source Han Sans SC', 'WenQuanYi Micro Hei', -apple-system,
    BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body,
#app {
  height: 100%;
  width: 100%;
  overflow: hidden;
}

body {
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  color: var(--text);
  background: var(--bg);
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

button,
input,
textarea,
select {
  font: inherit;
  color: inherit;
}
</style>

<style scoped>
.app-layout {
  display: flex;
  height: 100%;
  width: 100%;
  min-width: 0;
}

.main-content {
  flex: 1;
  min-width: 0;
  position: relative;
  overflow: hidden;
  background: var(--bg-hover);
}

.placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  text-align: center;
  color: var(--text-muted);
  padding: 16px;
}

.placeholder p {
  margin-bottom: 8px;
}

.placeholder .hint {
  font-size: 12px;
  opacity: 0.7;
}
</style>
