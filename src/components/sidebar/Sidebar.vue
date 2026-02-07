<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref } from 'vue'
import PaneSelector from './PaneSelector.vue'
import ProviderList from './ProviderList.vue'
import PromptComposer from './PromptComposer.vue'
import { MAX_PANES, SIDEBAR_KEY, type PaneCount, type SidebarContext } from './context'
import { DEFAULT_ACTIVE_PROVIDERS } from '@/providers'
import { getSidebarRuntime } from '@/runtime/sidebar'

const runtime = getSidebarRuntime()

const collapsed = ref(false)
const paneCount = ref<PaneCount>(2)
const activeProviders = ref<string[]>([...DEFAULT_ACTIVE_PROVIDERS])

const configuredSidebarWidth = computed(() =>
  collapsed.value ? 64 : 280
)
const sidebarWidth = computed(() => `${configuredSidebarWidth.value}px`)

const normalizePaneCount = (count: number): PaneCount => {
  const normalized = Math.min(MAX_PANES, Math.max(1, Math.floor(count)))
  return normalized as PaneCount
}

// Layout sync
let layoutSyncQueue: Promise<void> = Promise.resolve()
let lastLayoutSignature: string | null = null

const buildLayoutSignature = (
  viewportWidth: number,
  viewportHeight: number,
  panes: PaneCount,
  sidebarW: number
): string => `${viewportWidth}x${viewportHeight}:${panes}:${sidebarW}`

const invalidateLayoutSignature = () => {
  lastLayoutSignature = null
}

const syncLayout = async () => {
  const viewportWidth = Math.max(1, Math.floor(window.innerWidth))
  const viewportHeight = Math.max(1, Math.floor(window.innerHeight))
  const sidebarW = configuredSidebarWidth.value
  const signature = buildLayoutSignature(viewportWidth, viewportHeight, paneCount.value, sidebarW)

  if (signature === lastLayoutSignature) return

  await runtime.updateLayout({
    viewportWidth,
    viewportHeight,
    paneCount: paneCount.value,
    sidebarWidth: sidebarW,
  })
  lastLayoutSignature = signature
}

const syncLayoutWithErrorHandling = async () => {
  layoutSyncQueue = layoutSyncQueue
    .then(() => syncLayout())
    .catch((e) => console.error('[Sidebar] syncLayout error:', e))
  await layoutSyncQueue
}

let resizeRaf = 0
const handleWindowResize = () => {
  if (resizeRaf !== 0) return
  resizeRaf = window.requestAnimationFrame(() => {
    resizeRaf = 0
    void syncLayoutWithErrorHandling()
  })
}

onMounted(async () => {
  window.addEventListener('resize', handleWindowResize)

  try {
    const config = await runtime.getConfig()
    if (config.defaults.providers.length > 0) {
      activeProviders.value = [...config.defaults.providers]
    }
    paneCount.value = normalizePaneCount(config.defaults.pane_count)
  } catch (e) {
    console.error('[Sidebar] loadConfig error:', e)
  }

  await syncLayoutWithErrorHandling()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize)
  if (resizeRaf !== 0) {
    window.cancelAnimationFrame(resizeRaf)
    resizeRaf = 0
  }
})

const toggleCollapse = async () => {
  collapsed.value = !collapsed.value
  await syncLayoutWithErrorHandling()
}

const setPaneCount = async (count: number) => {
  const oldCount = paneCount.value
  const newCount = normalizePaneCount(count)
  if (newCount === oldCount) return
  paneCount.value = newCount

  try {
    await runtime.setPaneCount(newCount)
  } catch (e) {
    invalidateLayoutSignature()
    paneCount.value = oldCount
    console.error('[Sidebar] setPaneCount error:', e)
  }
}

const setProvider = async (paneIndex: number, providerKey: string) => {
  if (activeProviders.value[paneIndex] === providerKey) return

  try {
    await runtime.updateProvider(paneIndex, providerKey, paneCount.value)
    activeProviders.value[paneIndex] = providerKey
  } catch (e) {
    console.error('[Sidebar] setProvider error:', e)
  }
}

const sendPrompt = async (text: string) => {
  try {
    await runtime.sendPrompt(text)
  } catch (e) {
    console.error('[Sidebar] sendPrompt error:', e)
    throw e
  }
}

const sidebarContext: SidebarContext = {
  paneCount,
  activeProviders,
  setPaneCount,
  setProvider,
  sendPrompt,
}

provide(SIDEBAR_KEY, sidebarContext)
</script>

<template>
  <aside
    class="sidebar"
    :class="{ collapsed }"
    :style="{ width: sidebarWidth }"
    data-testid="sidebar"
  >
    <div class="sidebar-header">
      <span class="sidebar-title" data-testid="sidebar-title">LAZY LLM</span>
      <button
        class="collapse-btn"
        title="Toggle sidebar"
        data-testid="sidebar-collapse"
        @click="void toggleCollapse()"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="11 17 6 12 11 7"></polyline>
          <polyline points="18 17 13 12 18 7"></polyline>
        </svg>
      </button>
    </div>

    <div class="sidebar-content" data-testid="sidebar-content">
      <div class="sidebar-scroll" data-testid="sidebar-scroll">
        <PaneSelector />
        <ProviderList />
      </div>
      <PromptComposer />
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 12px;
  background: var(--bg);
  border-right: 1px solid var(--border);
  box-sizing: border-box;
  flex-shrink: 0;
  position: relative;
  z-index: 10;
}

.sidebar.collapsed {
  padding: 8px 0;
  align-items: center;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 16px;
}

.sidebar.collapsed .sidebar-header {
  width: 100%;
  border-bottom: none;
  padding-bottom: 0;
  margin-bottom: 0;
  justify-content: center;
}

.sidebar-title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.sidebar.collapsed .sidebar-title {
  display: none;
}

.collapse-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.15s, color 0.15s;
}

.collapse-btn:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.collapse-btn svg {
  width: 16px;
  height: 16px;
  transition: transform 0.2s;
}

.sidebar.collapsed .collapse-btn {
  width: 28px;
  height: 28px;
}

.sidebar.collapsed .collapse-btn svg {
  transform: rotate(180deg);
}

.sidebar-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.sidebar-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 2px;
}

.sidebar-scroll::-webkit-scrollbar {
  width: 8px;
}

.sidebar-scroll::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 8px;
}

.sidebar.collapsed .sidebar-content {
  display: none;
}
</style>
