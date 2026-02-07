<script setup lang="ts">
import Select from '@/components/ui/Select.vue'
import { providerMetas } from '@/providers'

const props = defineProps<{
  selectedKey: string
  testid?: string
}>()

const emit = defineEmits<{
  change: [providerKey: string]
}>()

const handleChange = (key: string) => {
  emit('change', key)
}
</script>

<template>
  <Select
    :model-value="selectedKey"
    :testid="testid"
    @update:model-value="handleChange"
  />
</template>
