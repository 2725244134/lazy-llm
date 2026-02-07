<script setup lang="ts">
import { computed, inject } from 'vue'
import SidebarSection from './SidebarSection.vue'
import { SIDEBAR_KEY } from './context'
import { providerMetas, providerIcons } from '@/providers'

const sidebar = inject(SIDEBAR_KEY)!

const paneIndices = computed(() =>
  Array.from({ length: sidebar.paneCount.value }, (_, paneIndex) => paneIndex)
)

const getProviderForPane = (paneIndex: number) => {
  return sidebar.activeProviders.value[paneIndex] || 'chatgpt'
}

const selectProvider = (paneIndex: number, providerKey: string) => {
  void sidebar.setProvider(paneIndex, providerKey)
}
</script>

<template>
  <SidebarSection title="PROVIDERS">
    <div class="pane-providers">
      <div
        v-for="paneIndex in paneIndices"
        :key="paneIndex"
        class="pane-row"
        :data-testid="`provider-row-${paneIndex}`"
      >
        <div class="pane-label">{{ paneIndex + 1 }}</div>
        <div class="provider-grid">
          <button
            v-for="provider in providerMetas"
            :key="provider.key"
            class="provider-icon-btn"
            :class="{ active: getProviderForPane(paneIndex) === provider.key }"
            :title="provider.name"
            :data-testid="`provider-${paneIndex}-${provider.key}`"
            @click="selectProvider(paneIndex, provider.key)"
          >
            <component
              :is="providerIcons[provider.key]"
              class="provider-icon"
            />
          </button>
        </div>
      </div>
    </div>
  </SidebarSection>
</template>

<style scoped>
.pane-providers {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pane-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pane-label {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  background: var(--bg-hover);
  border-radius: 4px;
  flex-shrink: 0;
}

.provider-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
}

.provider-icon-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  cursor: pointer;
  transition: all 0.15s ease;
  padding: 0;
}

.provider-icon-btn:hover {
  border-color: var(--text-muted);
  background: var(--bg-hover);
  transform: scale(1.05);
}

.provider-icon-btn.active {
  border-color: var(--broadcast);
  background: rgba(79, 70, 229, 0.1);
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.2);
}

.provider-icon-btn .provider-icon {
  width: 18px;
  height: 18px;
}

.provider-icon-btn :deep(svg) {
  width: 18px;
  height: 18px;
}

@media (prefers-color-scheme: dark) {
  .provider-icon-btn.active {
    background: rgba(79, 70, 229, 0.2);
  }
}
</style>
