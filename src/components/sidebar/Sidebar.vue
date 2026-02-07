<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref } from 'vue'
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
const quickPromptVisible = ref(false)
const quickPromptText = ref('')
const quickPromptLoading = ref(false)
const quickPromptInputEl = ref<HTMLInputElement | null>(null)

// Sidebar width from config (loaded on mount)
const expandedWidth = ref(280)
const collapsedWidth = ref(48)

const configuredSidebarWidth = computed(() =>
  collapsed.value ? collapsedWidth.value : expandedWidth.value
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
let focusRaf = 0
let quickPromptFocusRaf = 0

const focusPromptComposer = async () => {
  if (collapsed.value) return

  await nextTick()
  if (focusRaf !== 0) {
    window.cancelAnimationFrame(focusRaf)
  }
  focusRaf = window.requestAnimationFrame(() => {
    focusRaf = 0
    const textarea = document.querySelector<HTMLTextAreaElement>('[data-testid="prompt-textarea"]')
    if (!textarea || textarea.disabled) return
    textarea.focus()
    const cursorPos = textarea.value.length
    textarea.setSelectionRange(cursorPos, cursorPos)
  })
}

const handleWindowResize = () => {
  if (resizeRaf !== 0) return
  resizeRaf = window.requestAnimationFrame(() => {
    resizeRaf = 0
    void syncLayoutWithErrorHandling()
  })
}

const focusQuickPromptInput = async () => {
  await nextTick()
  if (quickPromptFocusRaf !== 0) {
    window.cancelAnimationFrame(quickPromptFocusRaf)
  }
  quickPromptFocusRaf = window.requestAnimationFrame(() => {
    quickPromptFocusRaf = 0
    const input = quickPromptInputEl.value
    if (!input || input.disabled) return
    input.focus()
    const cursorPos = input.value.length
    input.setSelectionRange(cursorPos, cursorPos)
  })
}

const openQuickPrompt = async () => {
  if (quickPromptVisible.value) return
  quickPromptVisible.value = true
  await focusQuickPromptInput()
}

const closeQuickPrompt = () => {
  if (quickPromptLoading.value) return
  quickPromptVisible.value = false
  quickPromptText.value = ''
  void focusPromptComposer()
}

const submitQuickPrompt = async () => {
  const prompt = quickPromptText.value.trim()
  if (prompt.length === 0 || quickPromptLoading.value) return

  quickPromptLoading.value = true
  try {
    await sendPrompt(prompt)
    quickPromptVisible.value = false
    quickPromptText.value = ''
    await focusPromptComposer()
  } finally {
    quickPromptLoading.value = false
  }
}

const handleQuickPromptKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    e.preventDefault()
    closeQuickPrompt()
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    void submitQuickPrompt()
  }
}

const handleGlobalKeydown = (e: KeyboardEvent) => {
  if (e.repeat) return
  const isShortcutModifier = e.ctrlKey || e.metaKey
  const isBaseShortcut = isShortcutModifier && !e.altKey && !e.shiftKey
  const key = e.key.toLowerCase()

  if (isBaseShortcut && key === 'j') {
    e.preventDefault()
    if (quickPromptVisible.value) {
      closeQuickPrompt()
    } else {
      void openQuickPrompt()
    }
    return
  }

  if (!(isBaseShortcut && key === 'b')) return

  e.preventDefault()
  void toggleCollapse()
}

onMounted(async () => {
  window.addEventListener('resize', handleWindowResize)
  window.addEventListener('keydown', handleGlobalKeydown)

  try {
    const config = await runtime.getConfig()
    // Load sidebar width from config
    expandedWidth.value = config.sidebar.expanded_width
    collapsedWidth.value = config.sidebar.collapsed_width
    if (config.defaults.providers.length > 0) {
      activeProviders.value = [...config.defaults.providers]
    }
    paneCount.value = normalizePaneCount(config.defaults.pane_count)
  } catch (e) {
    console.error('[Sidebar] loadConfig error:', e)
  }

  await syncLayoutWithErrorHandling()
  await focusPromptComposer()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize)
  window.removeEventListener('keydown', handleGlobalKeydown)
  if (resizeRaf !== 0) {
    window.cancelAnimationFrame(resizeRaf)
    resizeRaf = 0
  }
  if (focusRaf !== 0) {
    window.cancelAnimationFrame(focusRaf)
    focusRaf = 0
  }
  if (quickPromptFocusRaf !== 0) {
    window.cancelAnimationFrame(quickPromptFocusRaf)
    quickPromptFocusRaf = 0
  }
})

const toggleCollapse = async () => {
  collapsed.value = !collapsed.value
  await syncLayoutWithErrorHandling()
  if (!collapsed.value) {
    await focusPromptComposer()
  }
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
    await runtime.updateProvider(paneIndex, providerKey)
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

const syncPromptDraft = async (text: string) => {
  try {
    await runtime.syncPromptDraft(text)
  } catch (e) {
    // Draft syncing is best-effort and should not break typing flow.
    console.error('[Sidebar] syncPromptDraft error:', e)
  }
}

const sidebarContext: SidebarContext = {
  paneCount,
  activeProviders,
  setPaneCount,
  setProvider,
  syncPromptDraft,
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
        title="Toggle sidebar (Ctrl+B)"
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
        <PromptComposer />
      </div>
    </div>
  </aside>

  <div
    v-if="quickPromptVisible"
    class="quick-prompt-overlay"
    data-testid="quick-prompt-overlay"
    @click.self="closeQuickPrompt()"
  >
    <div class="quick-prompt-dialog" data-testid="quick-prompt-dialog">
      <input
        ref="quickPromptInputEl"
        v-model="quickPromptText"
        class="quick-prompt-input"
        data-testid="quick-prompt-input"
        type="text"
        placeholder="Just prompt."
        :disabled="quickPromptLoading"
        @keydown="handleQuickPromptKeydown"
      />
      <div class="quick-prompt-hint">Enter to send · Esc to close · Ctrl+J to toggle</div>
    </div>
  </div>
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
  -webkit-app-region: drag;
}

.sidebar.collapsed .sidebar-header {
  width: 100%;
  border-bottom: none;
  padding-bottom: 0;
  margin-bottom: 0;
  justify-content: center;
}

.sidebar-title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.5px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  -webkit-app-region: no-drag;
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
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 2px;
  display: flex;
  flex-direction: column;
  min-width: 0;
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

.quick-prompt-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 22vh 16px 16px;
  background: rgba(17, 24, 39, 0.2);
  backdrop-filter: blur(3px);
  z-index: 50;
}

.quick-prompt-dialog {
  width: min(960px, 100%);
  padding: 14px 16px 12px;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: color-mix(in srgb, var(--bg) 92%, #ffffff 8%);
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.28);
}

.quick-prompt-input {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 30px;
  line-height: 1.2;
  letter-spacing: 0.2px;
}

.quick-prompt-input::placeholder {
  color: color-mix(in srgb, var(--text-muted) 92%, transparent 8%);
}

.quick-prompt-input:focus {
  outline: none;
}

.quick-prompt-hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-muted);
  opacity: 0.9;
}

@media (max-width: 640px) {
  .quick-prompt-overlay {
    padding-top: 18vh;
  }

  .quick-prompt-dialog {
    border-radius: 14px;
    padding: 12px;
  }

  .quick-prompt-input {
    font-size: 22px;
  }
}
</style>
