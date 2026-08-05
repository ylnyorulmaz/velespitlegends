<template>
  <div class="empty-state">
    <div class="empty-state-icon" aria-hidden="true">{{ icon }}</div>
    <h6 class="empty-state-title">{{ title }}</h6>
    <p v-if="message" class="empty-state-message text-muted">{{ message }}</p>
    <slot />
  </div>
</template>

<script>
export default {
  name: 'EmptyState',
  props: {
    title: { type: String, default: 'Nothing here yet' },
    message: { type: String, default: '' },
    icon: { type: String, default: '—' },
  },
};
</script>
