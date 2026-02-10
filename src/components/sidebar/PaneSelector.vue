<script setup lang="ts">
import { inject } from 'vue'
import SidebarSection from './SidebarSection.vue'
import { MAX_PANES, SIDEBAR_KEY } from './context'

const sidebar = inject(SIDEBAR_KEY)!
</script>

<template>
  <SidebarSection title="PANES">
    <div class="pane-toggle">
      <button
        v-for="n in MAX_PANES"
        :key="n"
        class="chip"
        :class="{ active: sidebar.paneCount.value === n }"
        @click="void sidebar.setPaneCount(n)"
      >
        {{ n }}
      </button>
    </div>
    <button
      class="new-all-btn"
      title="Open provider home in all panes (Ctrl/Cmd+R)"
      @click="void sidebar.newAll()"
    >
      NEW ALL
    </button>
  </SidebarSection>
</template>

<style scoped>
.pane-toggle {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.chip {
  min-width: 0;
  padding: 8px 4px;
  border: 1.5px solid var(--border);
  background: var(--bg);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s ease-out;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.chip:hover {
  border-color: var(--accent);
  color: var(--accent);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
}

.chip.active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--bg);
  font-weight: 700;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.new-all-btn {
  width: 100%;
  margin-top: 10px;
  padding: 8px 10px;
  border: 1.5px dashed var(--border);
  background: transparent;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.4px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s ease-out;
}

.new-all-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--select-item-hover-bg);
}
</style>
