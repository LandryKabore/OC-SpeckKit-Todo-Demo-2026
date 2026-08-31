<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
  subtitle: {
    type: String,
    default: "",
  },
  wide: {
    type: Boolean,
    default: false,
  },
});
</script>

<template>
  <div class="auth-screen">
    <div class="auth-screen__pattern" aria-hidden="true" />

    <v-container class="auth-screen__container" fluid>
      <v-row align="center" justify="center" class="fill-height py-8">
        <v-col cols="12" :sm="wide ? 10 : 8" :md="wide ? 7 : 5" :lg="wide ? 5 : 4">
          <header class="auth-brand text-center mb-8">
            <div class="auth-brand__icon mb-3">
              <v-icon icon="mdi-checkbox-marked-circle-outline" size="40" />
            </div>
            <h1 class="auth-brand__title">Todo</h1>
            <p v-if="subtitle" class="auth-brand__subtitle">{{ subtitle }}</p>
          </header>

          <v-card class="auth-card" elevation="8" rounded="lg">
            <v-card-item class="auth-card__header pb-0">
              <v-card-title class="auth-card__title text-h5">
                {{ title }}
              </v-card-title>
            </v-card-item>

            <v-card-text class="auth-card__body pt-4">
              <slot />
            </v-card-text>

            <v-card-actions v-if="$slots.footer" class="auth-card__footer px-6 pb-6 pt-0">
              <slot name="footer" />
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<style scoped>
.auth-screen {
  position: relative;
  min-height: 100%;
  overflow: hidden;
  background: rgb(var(--v-theme-primary));
}

.auth-screen__pattern {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 15% 20%, rgba(255, 255, 255, 0.12) 0%, transparent 42%),
    radial-gradient(circle at 85% 75%, rgba(0, 0, 0, 0.14) 0%, transparent 45%);
  pointer-events: none;
}

.auth-screen__container {
  position: relative;
  z-index: 1;
  min-height: 100%;
}

.auth-brand__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.14);
  color: rgb(var(--v-theme-on-primary));
}

.auth-brand__title {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: rgb(var(--v-theme-on-primary));
}

.auth-brand__subtitle {
  margin: 8px 0 0;
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.88);
}

.auth-card {
  background: rgb(var(--v-theme-surface)) !important;
  border: 1px solid rgba(255, 255, 255, 0.35);
}

.auth-card__title {
  font-weight: 700;
  color: rgb(var(--v-theme-primary));
  padding: 0;
}

.auth-card__footer :deep(.v-btn) {
  color: rgb(var(--v-theme-primary));
  font-weight: 500;
  text-transform: none;
}
</style>
