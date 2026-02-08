<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { providerMetas, providerIcons } from '@/providers'

const props = defineProps<{
  modelValue: string
  loading?: boolean
  testid?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isOpen = ref(false)
const selectRef = ref<HTMLDivElement | null>(null)

const selectedProvider = computed(() =>
  providerMetas.find((p) => p.key === props.modelValue) ?? providerMetas[0]
)

const selectedIcon = computed(() => providerIcons[props.modelValue])

const toggle = () => {
  isOpen.value = !isOpen.value
}

const select = (key: string) => {
  emit('update:modelValue', key)
  isOpen.value = false
}

const handleClickOutside = (e: MouseEvent) => {
  if (selectRef.value && !selectRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div ref="selectRef" class="select-container" :data-testid="testid">
    <button
      type="button"
      class="select-trigger"
      :class="{ 'is-open': isOpen, 'is-loading': props.loading }"
      @click="toggle"
    >
      <span class="trigger-content">
        <span v-if="selectedIcon" class="trigger-icon">
          <component :is="selectedIcon" class="icon" />
        </span>
        <span class="trigger-label">{{ selectedProvider.name }}</span>
      </span>
      <span
        v-if="props.loading"
        class="loading-spinner"
        aria-label="Provider loading"
        role="status"
      ></span>
      <svg
        class="chevron"
        :class="{ 'is-open': isOpen }"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>

    <transition name="dropdown">
      <div v-show="isOpen" class="dropdown-menu">
        <div class="dropdown-scroll">
          <div
            v-for="provider in providerMetas"
            :key="provider.key"
            class="dropdown-item"
            :class="{ 'is-selected': provider.key === modelValue }"
            @click="select(provider.key)"
          >
            <span v-if="providerIcons[provider.key]" class="item-icon">
              <component :is="providerIcons[provider.key]" class="icon" />
            </span>
            <span class="item-label">{{ provider.name }}</span>
            <svg
              v-if="provider.key === modelValue"
              class="checkmark"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.select-container {
  position: relative;
  width: 100%;
}

.select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 12px;
  background: var(--bg);
  border: 1.5px solid var(--border);
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.select-trigger:hover {
  border-color: var(--accent);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.select-trigger.is-open {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--select-open-ring);
}

.select-trigger.is-loading {
  border-color: var(--accent);
}

.trigger-content {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.trigger-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.trigger-icon :deep(svg) {
  display: block;
  width: 24px;
  height: 24px;
}

.trigger-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chevron {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  opacity: 0.5;
  transition: all 0.25s ease;
}

.loading-spinner {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  margin-right: 6px;
  animation: spin 0.8s linear infinite;
}

.chevron.is-open {
  transform: rotate(180deg);
  opacity: 1;
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 50;
  background: var(--bg);
  border: 1.5px solid var(--border);
  border-radius: 12px;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 10px 20px -5px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.dropdown-scroll {
  max-height: 280px;
  overflow-y: auto;
  padding: 6px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 8px;
  font-size: 15px;
  color: var(--text);
  cursor: pointer;
  transition: all 0.15s ease;
  margin-bottom: 2px;
}

.dropdown-item:last-child {
  margin-bottom: 0;
}

.dropdown-item:hover {
  background: var(--select-item-hover-bg);
}

.dropdown-item.is-selected {
  background: var(--select-item-selected-bg);
  font-weight: 600;
}

.item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.item-icon :deep(svg) {
  display: block;
  width: 24px;
  height: 24px;
  opacity: 1;
}

.item-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.checkmark {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  stroke: var(--broadcast);
}

/* Dropdown Animation */
.dropdown-enter-active {
  transition: all 0.2s ease-out;
}

.dropdown-leave-active {
  transition: all 0.15s ease-in;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.96);
}

.dropdown-enter-to,
.dropdown-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}

/* Scrollbar styling */
.dropdown-scroll::-webkit-scrollbar {
  width: 6px;
}

.dropdown-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.dropdown-scroll::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
