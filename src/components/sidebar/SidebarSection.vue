<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <div class="section">
    <div class="section-title">{{ title }}</div>
    <slot />
  </div>
</template>

<style scoped>
.section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.8px;
  color: var(--text-muted);
  margin-bottom: 12px;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-title::before {
  content: '';
  width: 2px;
  height: 12px;
  background: var(--accent);
  border-radius: 1px;
}
</style>
