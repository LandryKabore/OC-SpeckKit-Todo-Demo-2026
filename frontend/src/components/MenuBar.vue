<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import Utils from "../config/utils.js";
import { emailRules } from "../config/validation.js";
import authServices from "../services/authServices.js";
import userServices from "../services/userServices.js";

const user = ref(Utils.getStore("user"));
const profileMenuOpen = ref(false);
const editDialogOpen = ref(false);
const editForm = ref(null);
const loggingOut = ref(false);
const savingProfile = ref(false);
const profileError = ref("");

const fName = ref("");
const lName = ref("");
const email = ref("");
const username = ref("");
const password = ref("");
const confirmPassword = ref("");

const fNameRules = [(value) => !!value?.trim() || "First name is required."];
const lNameRules = [(value) => !!value?.trim() || "Last name is required."];
const usernameRules = [(value) => !!value?.trim() || "Username is required."];
const passwordRules = [
  (value) => !value || value.length >= 8 || "Password must be at least 8 characters.",
];
const confirmPasswordRules = [
  (value) => !password.value || value === password.value || "Passwords do not match.",
];

const displayName = computed(() => Utils.getUserDisplayName(user.value));

const refreshUser = () => {
  user.value = Utils.getStore("user");
};

onMounted(() => {
  window.addEventListener("user-logged-in", refreshUser);
});

onUnmounted(() => {
  window.removeEventListener("user-logged-in", refreshUser);
});

const resetPasswordFields = () => {
  password.value = "";
  confirmPassword.value = "";
};

const populateEditForm = (profile) => {
  fName.value = profile.fName ?? "";
  lName.value = profile.lName ?? "";
  email.value = profile.email ?? "";
  username.value = profile.username ?? "";
  resetPasswordFields();
};

const openEditDialog = async () => {
  profileMenuOpen.value = false;
  profileError.value = "";

  if (!user.value?.userId) {
    return;
  }

  try {
    const response = await userServices.getUser(user.value.userId);
    populateEditForm(response.data);
    editDialogOpen.value = true;
  } catch (error) {
    populateEditForm(user.value);
    profileError.value = error.response?.data?.message || "Failed to load profile.";
    editDialogOpen.value = true;
  }
};

const closeEditDialog = () => {
  editDialogOpen.value = false;
  profileError.value = "";
  resetPasswordFields();
};

const handleSaveProfile = async () => {
  profileError.value = "";
  const { valid } = await editForm.value.validate();

  if (!valid || !user.value?.userId) {
    return;
  }

  savingProfile.value = true;

  try {
    const payload = {
      fName: fName.value.trim(),
      lName: lName.value.trim(),
      email: email.value.trim(),
      username: username.value.trim(),
    };

    if (password.value) {
      payload.password = password.value;
    }

    const response = await userServices.updateUser(user.value.userId, payload);
    const currentUser = Utils.getStore("user");

    Utils.setStore("user", {
      ...currentUser,
      ...response.data,
      userId: response.data.id,
      fName: response.data.fName,
      lName: response.data.lName,
      email: response.data.email,
      username: response.data.username,
      token: currentUser.token,
    });
    refreshUser();
    window.dispatchEvent(new CustomEvent("user-logged-in"));
    closeEditDialog();
  } catch (error) {
    profileError.value = error.response?.data?.message || "Failed to update profile.";
  } finally {
    savingProfile.value = false;
  }
};

const handleLogout = async () => {
  profileMenuOpen.value = false;
  loggingOut.value = true;

  try {
    await authServices.logoutUser();
  } finally {
    loggingOut.value = false;
  }
};
</script>

<template>
  <v-app-bar color="primary" density="comfortable" elevation="2">
    <template #prepend>
      <v-icon icon="mdi-checkbox-marked-circle-outline" class="ml-2 mr-1" />
    </template>

    <v-app-bar-title class="font-weight-bold">Todo</v-app-bar-title>

    <v-spacer />

    <v-menu
      v-if="user"
      v-model="profileMenuOpen"
      :close-on-content-click="false"
      location="bottom end"
      offset="8"
    >
      <template #activator="{ props: menuProps }">
        <v-btn
          v-bind="menuProps"
          variant="text"
          color="white"
          class="profile-menu-btn text-none"
          aria-label="Open profile menu"
        >
          <v-icon icon="mdi-account-circle" start />
          <span class="profile-menu-btn__name">{{ displayName }}</span>
          <v-icon icon="mdi-chevron-down" end size="18" />
        </v-btn>
      </template>

      <v-card class="profile-menu-card" min-width="300" rounded="lg">
        <v-card-item class="profile-menu-card__header">
          <template #prepend>
            <v-avatar color="primary" size="44">
              <v-icon icon="mdi-account" color="white" />
            </v-avatar>
          </template>

          <v-card-title class="profile-menu-card__name">{{ displayName }}</v-card-title>
          <v-card-subtitle class="profile-menu-card__meta">
            <div>@{{ user.username }}</div>
            <div>{{ user.email }}</div>
          </v-card-subtitle>
        </v-card-item>

        <v-divider />

        <v-card-actions class="px-4 py-3">
          <v-btn
            color="primary"
            variant="elevated"
            class="oc-cta"
            block
            prepend-icon="mdi-account-edit"
            @click="openEditDialog"
          >
            Edit Profile
          </v-btn>
        </v-card-actions>

        <v-divider />

        <v-card-actions class="px-4 py-3">
          <v-btn
            variant="outlined"
            color="error"
            block
            prepend-icon="mdi-logout"
            :loading="loggingOut"
            @click="handleLogout"
          >
            Log out
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-menu>

    <v-dialog v-model="editDialogOpen" max-width="560">
      <v-card>
        <v-card-title>Edit Profile</v-card-title>
        <v-card-text>
          <v-form ref="editForm" @submit.prevent="handleSaveProfile">
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="fName"
                  label="First name"
                  density="comfortable"
                  autocomplete="given-name"
                  :rules="fNameRules"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="lName"
                  label="Last name"
                  density="comfortable"
                  autocomplete="family-name"
                  :rules="lNameRules"
                />
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="email"
                  label="Email"
                  type="email"
                  density="comfortable"
                  autocomplete="email"
                  :rules="emailRules"
                />
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="username"
                  label="Username"
                  density="comfortable"
                  autocomplete="username"
                  :rules="usernameRules"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="password"
                  label="New password"
                  type="password"
                  density="comfortable"
                  autocomplete="new-password"
                  :rules="passwordRules"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="confirmPassword"
                  label="Confirm password"
                  type="password"
                  density="comfortable"
                  autocomplete="new-password"
                  :rules="confirmPasswordRules"
                />
              </v-col>
            </v-row>

            <v-alert
              v-if="profileError"
              type="error"
              density="compact"
              class="mt-2"
            >
              {{ profileError }}
            </v-alert>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeEditDialog">Cancel</v-btn>
          <v-btn
            color="primary"
            variant="elevated"
            :loading="savingProfile"
            @click="handleSaveProfile"
          >
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-app-bar>
</template>

<style scoped>
.profile-menu-btn {
  max-width: 240px;
  letter-spacing: 0.01em;
}

.profile-menu-btn__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-menu-card__header {
  padding: 16px 16px 12px;
}

.profile-menu-card__name {
  font-size: 1.05rem;
  font-weight: 700;
  color: rgb(var(--v-theme-primary));
  padding: 0;
  line-height: 1.3;
}

.profile-menu-card__meta {
  opacity: 0.8;
  padding: 0;
  line-height: 1.45;
}
</style>
