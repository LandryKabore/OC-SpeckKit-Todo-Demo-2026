<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import AuthLayout from "../components/AuthLayout.vue";
import authServices from "../services/authServices.js";
import Utils from "../config/utils.js";

const router = useRouter();
const form = ref(null);
const username = ref("");
const password = ref("");
const loading = ref(false);
const errorMessage = ref("");

const usernameRules = [(value) => !!value?.trim() || "Username is required."];
const passwordRules = [(value) => !!value || "Password is required."];

const handleSubmit = async () => {
  errorMessage.value = "";
  const { valid } = await form.value.validate();

  if (!valid) {
    return;
  }

  loading.value = true;

  try {
    const response = await authServices.loginUser({
      username: username.value.trim(),
      password: password.value,
    });

    Utils.setStore("user", response.data);
    window.dispatchEvent(new CustomEvent("user-logged-in"));
    await router.push({ name: "home" });
  } catch (error) {
    errorMessage.value = Utils.getAuthErrorMessage(error, "Login failed.");
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <AuthLayout title="Sign in" subtitle="Welcome back — pick up where you left off.">
    <v-form ref="form" @submit.prevent="handleSubmit">
      <v-text-field
        v-model="username"
        label="Username"
        prepend-inner-icon="mdi-account-outline"
        autocomplete="username"
        :rules="usernameRules"
        class="mb-1"
      />

      <v-text-field
        v-model="password"
        label="Password"
        type="password"
        prepend-inner-icon="mdi-lock-outline"
        autocomplete="current-password"
        :rules="passwordRules"
        class="mb-1"
      />

      <v-alert
        v-if="errorMessage"
        type="error"
        variant="tonal"
        density="comfortable"
        class="auth-error-alert mb-4 mt-2"
        icon="mdi-alert-circle-outline"
        border="start"
      >
        {{ errorMessage }}
      </v-alert>

      <v-btn
        type="submit"
        color="primary"
        variant="elevated"
        size="large"
        rounded="lg"
        block
        class="oc-cta auth-submit-btn mt-2"
        :loading="loading"
      >
        Sign in
      </v-btn>
    </v-form>

    <template #footer>
      <v-btn variant="text" :to="{ name: 'register' }" block>
        Create an account
      </v-btn>
    </template>
  </AuthLayout>
</template>
