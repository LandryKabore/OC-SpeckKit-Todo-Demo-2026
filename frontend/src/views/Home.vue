<script setup>
import { computed } from "vue";
import Utils from "../config/utils.js";
import authServices from "../services/authServices.js";

const user = computed(() => Utils.getStore("user"));

const handleSignOut = async () => {
  await authServices.logoutUser();
};
</script>

<template>
  <v-container class="fill-height">
    <v-row align="center" justify="center" class="fill-height">
      <v-col cols="12" sm="8" md="6" lg="4">
        <v-card elevation="2">
          <v-card-title class="text-h5">
            Welcome, {{ user?.fName || "there" }}!
          </v-card-title>

          <v-card-text>
            <p class="text-body-1">
              You are signed in. The full todo dashboard will be built in Feature 2.
            </p>
          </v-card-text>

          <v-card-actions>
            <v-btn color="primary" variant="elevated" @click="handleSignOut">
              Sign out
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
