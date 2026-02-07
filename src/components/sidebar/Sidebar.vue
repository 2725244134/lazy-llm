<script setup lang="ts">
import { ref } from 'vue';

const expanded = ref(true);
const paneCount = ref(2);

const toggleSidebar = () => {
  expanded.value = !expanded.value;
};

const setPaneCount = async (count: 1 | 2 | 3 | 4) => {
  paneCount.value = count;
  if (window.council) {
    await window.council.setPaneCount({ count });
  }
};
</script>

<template>
  <aside
    class="sidebar"
    :class="{ collapsed: !expanded }"
    data-testid="sidebar"
  >
    <div class="sidebar-header">
      <button
        class="toggle-btn"
        @click="toggleSidebar"
        data-testid="sidebar-toggle"
      >
        {{ expanded ? '<<' : '>>' }}
      </button>
    </div>

    <div v-if="expanded" class="sidebar-content">
      <div class="section">
        <h3>Panes</h3>
        <div class="pane-buttons">
          <button
            v-for="n in [1, 2, 3, 4] as const"
            :key="n"
            :class="{ active: paneCount === n }"
            @click="setPaneCount(n)"
            :data-testid="`pane-btn-${n}`"
          >
            {{ n }}
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 280px;
  height: 100%;
  background: var(--bg);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  transition: width 0.2s ease;
}

.sidebar.collapsed {
  width: 48px;
}

.sidebar-header {
  padding: 12px;
  border-bottom: 1px solid var(--border);
}

.toggle-btn {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  color: var(--text);
}

.toggle-btn:hover {
  background: var(--bg-hover);
}

.sidebar-content {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
}

.section h3 {
  font-size: 12px;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.pane-buttons {
  display: flex;
  gap: 4px;
}

.pane-buttons button {
  flex: 1;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
}

.pane-buttons button:hover {
  background: var(--bg-hover);
}

.pane-buttons button.active {
  background: var(--accent);
  color: var(--bg);
  border-color: var(--accent);
}
</style>
