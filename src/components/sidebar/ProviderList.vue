<script setup lang="ts">
import { computed, inject } from 'vue'
import SidebarSection from './SidebarSection.vue'
import ProviderDropdown from './ProviderDropdown.vue'
import { SIDEBAR_KEY } from './context'

const sidebar = inject(SIDEBAR_KEY)!
const paneIndices = computed(() =>
  Array.from({ length: sidebar.paneCount.value }, (_, paneIndex) => paneIndex)
)
</script>

<template>
  <SidebarSection title="PROVIDERS">
    <div class="provider-list">
      <div
        v-for="paneIndex in paneIndices"
        :key="paneIndex"
        class="provider-item"
        :data-testid="`provider-row-${paneIndex}`"
      >
        <div class="provider-label" :data-testid="`provider-label-${paneIndex}`">
          Pane {{ paneIndex + 1 }}
        </div>
        <ProviderDropdown
          :selected-key="sidebar.activeProviders.value[paneIndex] || 'chatgpt'"
          :testid="`provider-select-${paneIndex}`"
          @change="(key) => void sidebar.setProvider(paneIndex, key)"
        />
      </div>
    </div>
  </SidebarSection>
</template>

<style scoped>
.provider-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.provider-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.provider-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
</style>
