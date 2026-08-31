<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import AuthLayout from "../components/AuthLayout.vue";
import authServices from "../services/authServices.js";
import Utils from "../config/utils.js";
import { emailRules } from "../config/validation.js";

const router = useRouter();
const form = ref(null);
const fName = ref("");
const lName = ref("");
const email = ref("");
const username = ref("");
const password = ref("");
const confirmPassword = ref("");
const loading = ref(false);
const errorMessage = ref("");

const fNameRules = [(value) => !!value?.trim() || "First name is required."];
const lNameRules = [(value) => !!value?.trim() || "Last name is required."];
const usernameRules = [(value) => !!value?.trim() || "Username is required."];
const passwordRules = [
  (value) => !!value || "Password is required.",
  (value) => value.length >= 8 || "Password must be at least 8 characters.",
];
const confirmPasswordRules = [
  (value) => !!value || "Password is required.",
  (value) => value === password.value || "Passwords do not match.",
];

const handleSubmit = async () => {
  errorMessage.value = "";
  const { valid } = await form.value.validate();

  if (!valid) {
    return;
  }

  loading.value = true;

  try {
    const response = await authServices.registerUser({
      fName: fName.value.trim(),
      lName: lName.value.trim(),
      email: email.value.trim(),
      username: username.value.trim(),
      password: password.value,
    });

    Utils.setStore("user", response.data);
    window.dispatchEvent(new CustomEvent("user-logged-in"));
    await router.push({ name: "home" });
  } catch (error) {
    errorMessage.value = Utils.getAuthErrorMessage(error, "Registration failed.");
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <AuthLayout
    title="Create account"
    subtitle="Start organizing your tasks in minutes."
    wide
  >
    <v-form ref="form" @submit.prevent="handleSubmit">
      <v-row>
        <v-col cols="12" md="6">
          <v-text-field
            v-model="fName"
            label="First name"
            prepend-inner-icon="mdi-account-outline"
            autocomplete="given-name"
            :rules="fNameRules"
          />
        </v-col>

        <v-col cols="12" md="6">
          <v-text-field
            v-model="lName"
            label="Last name"
            autocomplete="family-name"
            :rules="lNameRules"
          />
        </v-col>

        <v-col cols="12">
          <v-text-field
            v-model="email"
            label="Email"
            type="email"
            prepend-inner-icon="mdi-email-outline"
            autocomplete="email"
            :rules="emailRules"
          />
        </v-col>

        <v-col cols="12">
          <v-text-field
            v-model="username"
            label="Username"
            prepend-inner-icon="mdi-at"
            autocomplete="username"
            :rules="usernameRules"
          />
        </v-col>

        <v-col cols="12" md="6">
          <v-text-field
            v-model="password"
            label="Password"
            type="password"
            prepend-inner-icon="mdi-lock-outline"
            autocomplete="new-password"
            :rules="passwordRules"
          />
        </v-col>

        <v-col cols="12" md="6">
          <v-text-field
            v-model="confirmPassword"
            label="Confirm password"
            type="password"
            prepend-inner-icon="mdi-lock-check-outline"
            autocomplete="new-password"
            :rules="confirmPasswordRules"
          />
        </v-col>
      </v-row>

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
        class="oc-cta auth-submit-btn"
        :loading="loading"
      >
        Create account
      </v-btn>
    </v-form>

    <template #footer>
      <v-btn variant="text" :to="{ name: 'login' }" block>
        Already have an account? Sign in
      </v-btn>
    </template>
  </AuthLayout>
</template>
