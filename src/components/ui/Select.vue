<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { providerMetas } from '@/providers'

const props = defineProps<{
  modelValue: string
  testid?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isOpen = ref(false)

const selectedProvider = computed(() =>
  providerMetas.find((p) => p.key === props.modelValue) ?? providerMetas[0]
)

const toggle = () => {
  isOpen.value = !isOpen.value
}

const select = (key: string) => {
  emit('update:modelValue', key)
  isOpen.value = false
}

// Close dropdown when clicking outside
const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('.select-wrapper')) {
    isOpen.value = false
  }
}

watch(isOpen, (open) => {
  if (open) {
    document.addEventListener('click', handleClickOutside)
  } else {
    document.removeEventListener('click', handleClickOutside)
  }
})
</script>

<template>
  <div class="select-wrapper" :data-testid="testid">
    <button
      class="select-trigger"
      :class="{ open: isOpen }"
      @click="toggle"
    >
      <span class="select-value">{{ selectedProvider.name }}</span>
      <svg
        class="select-arrow"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>
    <div v-if="isOpen" class="select-dropdown">
      <button
        v-for="provider in providerMetas"
        :key="provider.key"
        class="select-option"
        :class="{ selected: provider.key === modelValue }"
        @click="select(provider.key)"
      >
        {{ provider.name }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.select-wrapper {
  position: relative;
  width: 100%;
}

.select-trigger {
  width: 100%;
  padding: 10px 12px;
  border: 1.5px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.2s ease-out;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.select-trigger:hover {
  border-color: var(--accent);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
}

.select-trigger.open {
  border-color: var(--accent);
}

.select-arrow {
  width: 16px;
  height: 16px;
  transition: transform 0.2s;
}

.select-trigger.open .select-arrow {
  transform: rotate(180deg);
}

.select-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--bg);
  border: 1.5px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
  overflow: hidden;
}

.select-option {
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}

.select-option:hover {
  background: var(--bg-hover);
}

.select-option.selected {
  background: var(--accent);
  color: var(--bg);
  font-weight: 600;
}
</style>
