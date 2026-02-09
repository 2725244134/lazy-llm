<script setup lang="ts">
import Select from '@/components/ui/Select.vue'

defineProps<{
  selectedKey: string
  loading?: boolean
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
    :loading="loading"
    @update:model-value="handleChange"
  />
</template>
