<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import MenuBar from "./components/MenuBar.vue";

const route = useRoute();

const showMenuBar = computed(() => !["login", "register"].includes(route.name));
</script>

<template>
  <v-app>
    <MenuBar v-if="showMenuBar" />
    <v-main :class="{ 'auth-main': !showMenuBar }">
      <router-view />
    </v-main>
  </v-app>
</template>

<style>
/* OC Academic Edition — typography (see ui-style-system.mdc) */
.v-application {
  font-family: Inter, sans-serif !important;
  font-size: 16px;
  font-weight: 400;
}

.v-application :is(h1, h2, h3, h4, h5, h6) {
  font-weight: 700;
  color: rgb(var(--v-theme-primary));
}

/* Primary labeled CTAs — shared size for peer buttons */
.v-btn.oc-cta {
  font-size: 0.875rem !important;
  font-weight: 500;
  letter-spacing: 0.01em;
  text-transform: none;
}

/* Auth forms — error alert and submit button */
.auth-error-alert {
  border-radius: 10px !important;
  font-size: 0.9375rem;
  line-height: 1.45;
}

.auth-error-alert .v-alert__content {
  font-weight: 500;
}

.auth-submit-btn {
  min-height: 48px !important;
  font-size: 1rem !important;
  font-weight: 600 !important;
  letter-spacing: 0.02em;
  text-transform: none;
  box-shadow: 0 2px 10px rgba(128, 19, 40, 0.22) !important;
}

.auth-main {
  background: rgb(var(--v-theme-primary)) !important;
}

/* Dashboard tooltips — high contrast on light page background */
.dashboard-tooltip {
  background: rgb(var(--v-theme-primary)) !important;
  color: rgb(var(--v-theme-on-primary)) !important;
  font-size: 0.8125rem !important;
  font-weight: 500;
  padding: 6px 10px !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18) !important;
}
</style>
