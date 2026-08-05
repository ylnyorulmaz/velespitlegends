<template>
  <div class="loading-state" :class="{ compact }">
    <div class="loading-spinner" aria-hidden="true" />
    <span class="loading-label">{{ label }}</span>
  </div>
</template>

<script>
export default {
  name: 'LoadingState',
  props: {
    label: { type: String, default: 'Loading…' },
    compact: { type: Boolean, default: false },
  },
};
</script>
