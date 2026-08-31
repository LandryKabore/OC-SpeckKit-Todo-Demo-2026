<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import listServices from "../services/listServices.js";
import todoServices from "../services/todoServices.js";
import Utils from "../config/utils.js";
import {
  formatDueDate,
  isTodoOverdue,
  optionalDueDateRules,
  toDateInputValue,
} from "../config/validation.js";

const lists = ref([]);
const listsLoading = ref(false);
const listsError = ref("");
const listStats = ref({});
const previewMenuOpen = ref({});
const user = ref(Utils.getStore("user"));
const greetingName = computed(() => Utils.getUserGreetingName(user.value));
const timeGreeting = computed(() => Utils.getTimeGreeting());

const welcomeMessage = computed(() => {
  let totalOverdue = 0;
  let totalIncomplete = 0;

  for (const list of lists.value) {
    const stats = listStats.value[list.id];
    if (!stats) {
      continue;
    }

    totalOverdue += stats.overdueCount ?? 0;
    totalIncomplete += (stats.total ?? 0) - (stats.completed ?? 0);
  }

  if (totalOverdue > 0) {
    return totalOverdue === 1
      ? "You have 1 overdue item waiting for you."
      : `You have ${totalOverdue} overdue items waiting for you.`;
  }

  if (totalIncomplete > 0) {
    return `${totalIncomplete} open task${totalIncomplete === 1 ? "" : "s"} across your lists.`;
  }

  if (lists.value.length === 0) {
    return "Create your first list to get started.";
  }

  return "You're all caught up. Nice work.";
});

const itemsDialogOpen = ref(false);
const itemsList = ref(null);
const todos = ref([]);
const todosLoading = ref(false);
const todosError = ref("");

const createDialogOpen = ref(false);
const renameDialogOpen = ref(false);
const deleteDialogOpen = ref(false);
const addTodoDialogOpen = ref(false);
const editTodoDialogOpen = ref(false);
const deleteTodoDialogOpen = ref(false);

const createForm = ref(null);
const renameForm = ref(null);
const addTodoForm = ref(null);
const editTodoForm = ref(null);

const newListName = ref("");
const renameListName = ref("");
const newTodoTitle = ref("");
const newTodoDueDate = ref("");
const editTodoTitle = ref("");
const editTodoDueDate = ref("");

const listToRename = ref(null);
const listToDelete = ref(null);
const todoToEdit = ref(null);
const todoToDelete = ref(null);

const createLoading = ref(false);
const renameLoading = ref(false);
const deleteLoading = ref(false);
const addTodoLoading = ref(false);
const editTodoLoading = ref(false);
const deleteTodoLoading = ref(false);
const dialogError = ref("");
const todoDialogError = ref("");

const listNameRules = [
  (value) => !!value?.trim() || "List name is required.",
  (value) => value.trim().length <= 100 || "List name must be 100 characters or fewer.",
];

const todoTitleRules = [
  (value) => !!value?.trim() || "Todo title is required.",
  (value) => value.trim().length <= 255 || "Todo title must be 255 characters or fewer.",
];

const dueDateRules = optionalDueDateRules;

const sortTodos = (items) =>
  [...items].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }

    return new Date(a.createdAt) - new Date(b.createdAt);
  });

const PREVIEW_ITEM_LIMIT = 5;

const parseDateOnly = (value) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const buildDueSummary = (items) => {
  const today = startOfToday();
  const incompleteWithDue = items.filter((todo) => !todo.completed && todo.dueDate);

  let overdueCount = 0;
  let earliestOverdueDate = null;
  let earliestOverdueTime = Infinity;
  let nextDueDate = null;
  let nextDueTime = Infinity;

  for (const todo of incompleteWithDue) {
    const due = parseDateOnly(todo.dueDate);
    const dueTime = due.getTime();

    if (due < today) {
      overdueCount += 1;
      if (dueTime < earliestOverdueTime) {
        earliestOverdueTime = dueTime;
        earliestOverdueDate = todo.dueDate;
      }
    } else if (dueTime < nextDueTime) {
      nextDueTime = dueTime;
      nextDueDate = todo.dueDate;
    }
  }

  return { overdueCount, earliestOverdueDate, nextDueDate };
};

const getRelativeDueLabel = (dueDate) => {
  const today = startOfToday();
  const due = parseDateOnly(dueDate);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);

  if (diffDays === 0) {
    return "Due today";
  }

  if (diffDays === 1) {
    return "Due tomorrow";
  }

  return `Due ${formatDueDate(dueDate)}`;
};

const emptyListStats = () => ({
  total: 0,
  completed: 0,
  preview: [],
  overdueCount: 0,
  earliestOverdueDate: null,
  nextDueDate: null,
});

const buildListStats = (items) => {
  const sorted = sortTodos(items);

  return {
    total: sorted.length,
    completed: sorted.filter((todo) => todo.completed).length,
    preview: sorted.slice(0, PREVIEW_ITEM_LIMIT).map((todo) => ({
      id: todo.id,
      title: todo.title,
      completed: todo.completed,
      dueDate: todo.dueDate,
    })),
    ...buildDueSummary(sorted),
  };
};

const syncListStats = (listId, items) => {
  listStats.value = {
    ...listStats.value,
    [listId]: buildListStats(items),
  };
};

const loadListStats = async () => {
  if (lists.value.length === 0) {
    listStats.value = {};
    return;
  }

  const statsEntries = await Promise.all(
    lists.value.map(async (list) => {
      try {
        const response = await todoServices.getTodos(list.id);
        return [list.id, buildListStats(response.data)];
      } catch {
        return [list.id, emptyListStats()];
      }
    })
  );

  listStats.value = Object.fromEntries(statsEntries);
};

const isListComplete = (listId) => {
  const stats = listStats.value[listId];
  return stats?.total > 0 && stats.completed === stats.total;
};

const getListProgressLabel = (listId) => {
  const stats = listStats.value[listId];

  if (!stats?.total) {
    return null;
  }

  if (stats.completed === stats.total) {
    return `${stats.completed}/${stats.total} done`;
  }

  return `${stats.completed}/${stats.total} done`;
};

const isListDueOverdue = (listId) => (listStats.value[listId]?.overdueCount ?? 0) > 0;

const getListDueLabel = (listId) => {
  const stats = listStats.value[listId];

  if (!stats?.total || isListComplete(listId)) {
    return null;
  }

  if (stats.overdueCount > 0) {
    return stats.overdueCount === 1 ? "1 item overdue" : `${stats.overdueCount} items overdue`;
  }

  if (stats.nextDueDate) {
    return getRelativeDueLabel(stats.nextDueDate);
  }

  return null;
};

const getListPreviewItems = (listId) => listStats.value[listId]?.preview ?? [];

const getListPreviewOverflow = (listId) => {
  const stats = listStats.value[listId];
  if (!stats?.total) {
    return 0;
  }

  return Math.max(0, stats.total - PREVIEW_ITEM_LIMIT);
};

const isPreviewTodoOverdue = (todo) =>
  !todo.completed && !!todo.dueDate && isTodoOverdue(todo);

const loadLists = async () => {
  listsLoading.value = true;
  listsError.value = "";

  try {
    const response = await listServices.getLists();
    lists.value = response.data;
    await loadListStats();
  } catch (error) {
    listsError.value = error.response?.data?.message || "Failed to load lists.";
  } finally {
    listsLoading.value = false;
  }
};

const loadTodos = async () => {
  if (!itemsList.value) {
    todos.value = [];
    return;
  }

  todosLoading.value = true;
  todosError.value = "";

  try {
    const response = await todoServices.getTodos(itemsList.value.id);
    todos.value = sortTodos(response.data);
    syncListStats(itemsList.value.id, todos.value);
  } catch (error) {
    todos.value = [];
    todosError.value = error.response?.data?.message || "Failed to load todos.";
  } finally {
    todosLoading.value = false;
  }
};

const closeAllPreviewMenus = () => {
  lists.value.forEach((list) => {
    previewMenuOpen.value[list.id] = false;
  });
};

const isPreviewOpen = (listId) =>
  !itemsDialogOpen.value && !!previewMenuOpen.value[listId];

const setPreviewOpen = (listId, open) => {
  if (!itemsDialogOpen.value) {
    previewMenuOpen.value[listId] = open;
  }
};

const openItemsDialog = async (list) => {
  closeAllPreviewMenus();
  itemsList.value = list;
  itemsDialogOpen.value = true;
  await loadTodos();
};

const closeItemsDialog = () => {
  itemsDialogOpen.value = false;
  itemsList.value = null;
  todos.value = [];
  todosError.value = "";
  closeAddTodoDialog();
  closeEditTodoDialog();
  closeDeleteTodoDialog();
};

const openCreateDialog = () => {
  dialogError.value = "";
  newListName.value = "";
  createDialogOpen.value = true;
};

const closeCreateDialog = () => {
  createDialogOpen.value = false;
  newListName.value = "";
  dialogError.value = "";
};

const handleCreateList = async () => {
  dialogError.value = "";
  const { valid } = await createForm.value.validate();

  if (!valid) {
    return;
  }

  createLoading.value = true;

  try {
    const response = await listServices.createList(newListName.value.trim());
    lists.value = [...lists.value, response.data].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    listStats.value = {
      ...listStats.value,
      [response.data.id]: emptyListStats(),
    };
    closeCreateDialog();
  } catch (error) {
    dialogError.value = error.response?.data?.message || "Failed to create list.";
  } finally {
    createLoading.value = false;
  }
};

const openRenameDialog = (list) => {
  dialogError.value = "";
  listToRename.value = list;
  renameListName.value = list.name;
  renameDialogOpen.value = true;
};

const closeRenameDialog = () => {
  renameDialogOpen.value = false;
  listToRename.value = null;
  renameListName.value = "";
  dialogError.value = "";
};

const handleRenameList = async () => {
  dialogError.value = "";
  const { valid } = await renameForm.value.validate();

  if (!valid || !listToRename.value) {
    return;
  }

  renameLoading.value = true;

  try {
    const response = await listServices.updateList(
      listToRename.value.id,
      renameListName.value.trim()
    );
    lists.value = lists.value
      .map((list) => (list.id === response.data.id ? response.data : list))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (itemsList.value?.id === response.data.id) {
      itemsList.value = response.data;
    }

    closeRenameDialog();
  } catch (error) {
    dialogError.value = error.response?.data?.message || "Failed to rename list.";
  } finally {
    renameLoading.value = false;
  }
};

const openDeleteDialog = (list) => {
  listToDelete.value = list;
  deleteDialogOpen.value = true;
};

const closeDeleteDialog = () => {
  deleteDialogOpen.value = false;
  listToDelete.value = null;
};

const handleDeleteList = async () => {
  if (!listToDelete.value) {
    return;
  }

  deleteLoading.value = true;

  try {
    await listServices.deleteList(listToDelete.value.id);
    const deletedId = listToDelete.value.id;
    lists.value = lists.value.filter((list) => list.id !== deletedId);
    const { [deletedId]: _removed, ...remainingStats } = listStats.value;
    listStats.value = remainingStats;

    if (itemsList.value?.id === listToDelete.value.id) {
      closeItemsDialog();
    }

    closeDeleteDialog();
  } catch (error) {
    listsError.value = error.response?.data?.message || "Failed to delete list.";
    closeDeleteDialog();
  } finally {
    deleteLoading.value = false;
  }
};

const openAddTodoDialog = () => {
  todoDialogError.value = "";
  newTodoTitle.value = "";
  newTodoDueDate.value = "";
  addTodoDialogOpen.value = true;
};

const openAddTodoFromPreview = async (list) => {
  closeAllPreviewMenus();

  if (itemsList.value?.id !== list.id || !itemsDialogOpen.value) {
    itemsList.value = list;
    itemsDialogOpen.value = true;
    await loadTodos();
  }

  openAddTodoDialog();
};

const closeAddTodoDialog = () => {
  addTodoDialogOpen.value = false;
  newTodoTitle.value = "";
  newTodoDueDate.value = "";
  todoDialogError.value = "";
};

const handleAddTodo = async () => {
  todoDialogError.value = "";
  const { valid } = await addTodoForm.value.validate();

  if (!valid || !itemsList.value) {
    return;
  }

  addTodoLoading.value = true;

  try {
    const response = newTodoDueDate.value
      ? await todoServices.createTodo(
          itemsList.value.id,
          newTodoTitle.value.trim(),
          newTodoDueDate.value
        )
      : await todoServices.createTodo(itemsList.value.id, newTodoTitle.value.trim());
    todos.value = sortTodos([...todos.value, response.data]);
    syncListStats(itemsList.value.id, todos.value);
    closeAddTodoDialog();
  } catch (error) {
    todoDialogError.value = error.response?.data?.message || "Failed to add todo.";
  } finally {
    addTodoLoading.value = false;
  }
};

const openEditTodoDialog = (todo) => {
  todoDialogError.value = "";
  todoToEdit.value = todo;
  editTodoTitle.value = todo.title;
  editTodoDueDate.value = toDateInputValue(todo.dueDate);
  editTodoDialogOpen.value = true;
};

const closeEditTodoDialog = () => {
  editTodoDialogOpen.value = false;
  todoToEdit.value = null;
  editTodoTitle.value = "";
  editTodoDueDate.value = "";
  todoDialogError.value = "";
};

const handleEditTodo = async () => {
  todoDialogError.value = "";
  const { valid } = await editTodoForm.value.validate();

  if (!valid || !todoToEdit.value) {
    return;
  }

  editTodoLoading.value = true;

  try {
    const response = await todoServices.updateTodo(todoToEdit.value.id, {
      title: editTodoTitle.value.trim(),
      dueDate: editTodoDueDate.value || null,
    });
    todos.value = sortTodos(
      todos.value.map((todo) => (todo.id === response.data.id ? response.data : todo))
    );
    syncListStats(itemsList.value.id, todos.value);
    closeEditTodoDialog();
  } catch (error) {
    todoDialogError.value = error.response?.data?.message || "Failed to update todo.";
  } finally {
    editTodoLoading.value = false;
  }
};

const openDeleteTodoDialog = (todo) => {
  todoToDelete.value = todo;
  deleteTodoDialogOpen.value = true;
};

const closeDeleteTodoDialog = () => {
  deleteTodoDialogOpen.value = false;
  todoToDelete.value = null;
};

const handleDeleteTodo = async () => {
  if (!todoToDelete.value) {
    return;
  }

  deleteTodoLoading.value = true;

  try {
    await todoServices.deleteTodo(todoToDelete.value.id);
    todos.value = todos.value.filter((todo) => todo.id !== todoToDelete.value.id);
    syncListStats(itemsList.value.id, todos.value);
    closeDeleteTodoDialog();
  } catch (error) {
    todosError.value = error.response?.data?.message || "Failed to delete todo.";
    closeDeleteTodoDialog();
  } finally {
    deleteTodoLoading.value = false;
  }
};

const refreshListStats = async (listId) => {
  const response = await todoServices.getTodos(listId);
  syncListStats(listId, response.data);

  if (itemsList.value?.id === listId) {
    todos.value = sortTodos(response.data);
  }
};

const applyTodoCompletion = async (listId, updatedTodo) => {
  if (itemsList.value?.id === listId) {
    todos.value = sortTodos(
      todos.value.map((item) => (item.id === updatedTodo.id ? updatedTodo : item))
    );
    syncListStats(listId, todos.value);
    return;
  }

  try {
    const response = await todoServices.getTodos(listId);
    syncListStats(listId, response.data);
  } catch {
    const stats = listStats.value[listId];
    if (!stats) {
      return;
    }

    const previous = stats.preview.find((item) => item.id === updatedTodo.id);
    let completed = stats.completed;

    if (previous && previous.completed !== updatedTodo.completed) {
      completed += updatedTodo.completed ? 1 : -1;
    }

    listStats.value = {
      ...listStats.value,
      [listId]: {
        ...stats,
        completed,
        preview: stats.preview.map((item) =>
          item.id === updatedTodo.id
            ? { ...item, completed: updatedTodo.completed }
            : item
        ),
      },
    };
  }
};

const toggleTodoCompletedForList = async (listId, todo, completed) => {
  try {
    const response = await todoServices.updateTodo(todo.id, { completed });
    await applyTodoCompletion(listId, response.data);
  } catch (error) {
    const message = error.response?.data?.message || "Failed to update todo.";

    if (itemsList.value?.id === listId) {
      todosError.value = message;
    } else {
      listsError.value = message;
    }
  }
};

const toggleTodoCompleted = async (todo, completed) => {
  if (!itemsList.value) {
    return;
  }

  await toggleTodoCompletedForList(itemsList.value.id, todo, completed);
};

onMounted(() => {
  loadLists();
  window.addEventListener("user-logged-in", refreshGreeting);
});

onUnmounted(() => {
  window.removeEventListener("user-logged-in", refreshGreeting);
});

const refreshGreeting = () => {
  user.value = Utils.getStore("user");
};

watch(itemsDialogOpen, (isOpen) => {
  if (isOpen) {
    closeAllPreviewMenus();
  }
});
</script>

<template>
  <div class="dashboard-page">
    <v-container class="dashboard-page__container py-8">
      <v-alert
        v-if="listsError"
        type="error"
        variant="tonal"
        density="comfortable"
        class="mb-6"
        icon="mdi-alert-circle-outline"
        border="start"
      >
        {{ listsError }}
      </v-alert>

      <section v-if="greetingName" class="dashboard-welcome mb-6">
        <p class="dashboard-welcome__time">{{ timeGreeting }}</p>
        <h1 class="dashboard-welcome__title">
          Welcome back, <span>{{ greetingName }}</span>
        </h1>
        <p class="dashboard-welcome__message">{{ welcomeMessage }}</p>
      </section>

      <header class="dashboard-header mb-6">
        <div>
          <h2 class="dashboard-section__title">My Lists</h2>
          <p class="dashboard-header__subtitle">Organize your tasks by list</p>
        </div>

        <v-btn
          color="primary"
          variant="elevated"
          class="oc-cta dashboard-header__cta"
          :disabled="listsLoading"
          @click="openCreateDialog"
        >
          + New List
        </v-btn>
      </header>

      <v-progress-linear
        v-if="listsLoading"
        indeterminate
        color="primary"
        rounded
        class="mb-6"
      />

      <v-card
        v-if="!listsLoading && lists.length === 0"
        class="dashboard-empty"
        elevation="2"
        rounded="lg"
      >
        <v-card-text class="text-center py-10">
          <div class="dashboard-empty__icon mb-4">
            <v-icon icon="mdi-playlist-plus" size="40" color="primary" />
          </div>
          <p class="text-h6 font-weight-bold mb-2">No lists yet</p>
          <p class="text-body-2 text-medium-emphasis mb-6">
            No lists yet. Create your first list.
          </p>
          <v-btn
            color="primary"
            variant="elevated"
            class="oc-cta"
            @click="openCreateDialog"
          >
            + New List
          </v-btn>
        </v-card-text>
      </v-card>

      <div v-else-if="!listsLoading" class="list-grid">
        <v-card
          v-for="list in lists"
          :key="list.id"
          class="list-card list-card--clickable"
          :class="{
            'list-card--complete': isListComplete(list.id),
            'list-card--overdue': isListDueOverdue(list.id) && !isListComplete(list.id),
          }"
          elevation="2"
          rounded="lg"
          @click="openItemsDialog(list)"
        >
          <div class="list-card__body">
            <v-menu
              :model-value="isPreviewOpen(list.id)"
              :open-on-hover="!itemsDialogOpen"
              :close-on-content-click="false"
              location="start center"
              :open-delay="180"
              :close-delay="120"
              offset="12"
              @update:model-value="setPreviewOpen(list.id, $event)"
            >
              <template #activator="{ props: menuProps }">
                <div
                  class="list-card__info list-card__info--preview"
                  v-bind="menuProps"
                >
                  <div
                    class="list-card__icon"
                    :class="{ 'list-card__icon--complete': isListComplete(list.id) }"
                  >
                    <v-icon
                      :icon="isListComplete(list.id) ? 'mdi-playlist-check' : 'mdi-format-list-checks'"
                      size="22"
                      :color="isListComplete(list.id) ? 'success' : 'primary'"
                    />
                  </div>

                  <div class="list-card__text">
                    <span class="list-card__name">{{ list.name }}</span>
                    <span
                      v-if="getListProgressLabel(list.id)"
                      class="list-card__status"
                      :class="{ 'list-card__status--complete': isListComplete(list.id) }"
                    >
                      {{ getListProgressLabel(list.id) }}
                    </span>
                    <span v-else class="list-card__status list-card__status--empty">
                      Empty
                    </span>
                    <span
                      v-if="getListDueLabel(list.id)"
                      class="list-card__due"
                      :class="{ 'list-card__due--overdue': isListDueOverdue(list.id) }"
                    >
                      <v-icon icon="mdi-calendar-clock" size="14" />
                      {{ getListDueLabel(list.id) }}
                    </span>
                  </div>
                </div>
              </template>

              <v-card
                class="list-preview"
                elevation="10"
                rounded="lg"
                min-width="300"
                max-width="340"
                @click.stop
              >
                <v-card-item class="list-preview__header">
                  <v-card-title class="list-preview__title">{{ list.name }}</v-card-title>
                  <v-card-subtitle class="list-preview__subtitle">
                    <template v-if="listStats[list.id]?.total">
                      {{ listStats[list.id].completed }}/{{ listStats[list.id].total }} complete
                    </template>
                    <template v-else>No items yet</template>
                  </v-card-subtitle>

                  <template #append>
                    <v-tooltip text="Add item" location="top" content-class="dashboard-tooltip">
                      <template #activator="{ props: tooltipProps }">
                        <v-btn
                          v-bind="tooltipProps"
                          icon="mdi-plus"
                          size="small"
                          color="primary"
                          variant="tonal"
                          aria-label="Add item from preview"
                          @click.stop="openAddTodoFromPreview(list)"
                        />
                      </template>
                    </v-tooltip>
                  </template>
                </v-card-item>

                <v-divider />

                <v-card-text class="list-preview__body">
                  <p
                    v-if="!getListPreviewItems(list.id).length"
                    class="list-preview__empty"
                  >
                    Hover to peek — this list is empty.
                  </p>

                  <ul v-else class="list-preview__items">
                    <li
                      v-for="todo in getListPreviewItems(list.id)"
                      :key="`${list.id}-preview-${todo.id}`"
                      class="list-preview__item"
                      :class="{ 'list-preview__item--completed': todo.completed }"
                    >
                      <v-checkbox
                        :model-value="todo.completed"
                        density="compact"
                        hide-details
                        color="primary"
                        base-color="primary"
                        false-icon="mdi-checkbox-blank-outline"
                        true-icon="mdi-checkbox-marked"
                        class="list-preview__check"
                        @click.stop
                        @update:model-value="toggleTodoCompletedForList(list.id, todo, $event)"
                      />
                      <div
                        class="list-preview__content list-preview__content--clickable"
                        @click.stop="toggleTodoCompletedForList(list.id, todo, !todo.completed)"
                      >
                        <span class="list-preview__item-title">{{ todo.title }}</span>
                        <span
                          v-if="todo.dueDate"
                          class="list-preview__due"
                          :class="{ 'todo-overdue': isPreviewTodoOverdue(todo) }"
                        >
                          Due {{ formatDueDate(todo.dueDate) }}
                        </span>
                      </div>
                    </li>
                  </ul>

                  <p v-if="getListPreviewOverflow(list.id)" class="list-preview__more">
                    + {{ getListPreviewOverflow(list.id) }} more item{{
                      getListPreviewOverflow(list.id) === 1 ? "" : "s"
                    }}…
                  </p>
                </v-card-text>

                <v-divider />

                <v-card-actions class="list-preview__footer px-4 py-2">
                  <span class="list-preview__hint">Use + to add, or click the list to open</span>
                </v-card-actions>
              </v-card>
            </v-menu>

            <div class="list-card__actions" @click.stop>
              <v-tooltip text="View items" location="top" content-class="dashboard-tooltip">
                <template #activator="{ props: tooltipProps }">
                  <v-btn
                    v-bind="tooltipProps"
                    icon="mdi-format-list-bulleted"
                    variant="text"
                    color="primary"
                    size="small"
                    :aria-label="`View items for ${list.name}`"
                    @click="openItemsDialog(list)"
                  />
                </template>
              </v-tooltip>

              <v-tooltip text="Rename" location="top" content-class="dashboard-tooltip">
                <template #activator="{ props: tooltipProps }">
                  <v-btn
                    v-bind="tooltipProps"
                    icon="mdi-pencil"
                    variant="text"
                    color="primary"
                    size="small"
                    aria-label="Edit list"
                    @click="openRenameDialog(list)"
                  />
                </template>
              </v-tooltip>

              <v-tooltip text="Delete" location="top" content-class="dashboard-tooltip">
                <template #activator="{ props: tooltipProps }">
                  <v-btn
                    v-bind="tooltipProps"
                    icon="mdi-delete"
                    variant="text"
                    color="error"
                    size="small"
                    aria-label="Delete list"
                    @click="openDeleteDialog(list)"
                  />
                </template>
              </v-tooltip>
            </div>
          </div>
        </v-card>
      </div>
    </v-container>

    <v-dialog v-model="itemsDialogOpen" max-width="640" scrollable>
      <v-card class="dashboard-dialog" rounded="lg">
        <v-card-item class="dashboard-dialog__header">
          <template #prepend>
            <div class="dashboard-dialog__icon">
              <v-icon icon="mdi-format-list-bulleted" color="primary" />
            </div>
          </template>

          <v-card-title class="dashboard-dialog__title">
            {{ itemsList?.name }} — Items
          </v-card-title>

          <template #append>
            <v-chip
              v-if="!todosLoading"
              size="small"
              color="primary"
              variant="tonal"
            >
              {{ todos.length }} {{ todos.length === 1 ? "item" : "items" }}
            </v-chip>
          </template>
        </v-card-item>

        <v-divider />

        <v-card-text class="dashboard-dialog__body">
          <v-alert
            v-if="todosError"
            type="error"
            variant="tonal"
            density="comfortable"
            class="mb-4"
            icon="mdi-alert-circle-outline"
            border="start"
          >
            {{ todosError }}
          </v-alert>

          <v-progress-linear
            v-if="todosLoading"
            indeterminate
            color="primary"
            rounded
            class="mb-4"
          />

          <div class="d-flex justify-end mb-4">
            <v-btn
              color="primary"
              variant="elevated"
              class="oc-cta"
              :disabled="todosLoading"
              @click="openAddTodoDialog"
            >
              + Add Item
            </v-btn>
          </div>

          <div
            v-if="!todosLoading && todos.length === 0"
            class="dashboard-empty dashboard-empty--compact text-center py-8"
          >
            <v-icon icon="mdi-checkbox-marked-circle-outline" size="36" color="primary" class="mb-3" />
            <p class="text-body-2 text-medium-emphasis">
              No todos in this list yet.
            </p>
          </div>

          <div v-else class="todo-list">
            <v-card
              v-for="todo in todos"
              :key="todo.id"
              class="todo-card"
              :class="{ 'todo-card--completed': todo.completed }"
              variant="outlined"
              rounded="lg"
            >
              <div class="todo-card__body">
                <v-checkbox
                  :model-value="todo.completed"
                  hide-details
                  color="primary"
                  base-color="primary"
                  false-icon="mdi-checkbox-blank-outline"
                  true-icon="mdi-checkbox-marked"
                  class="todo-card__checkbox"
                  @update:model-value="toggleTodoCompleted(todo, $event)"
                />

                <div
                  class="todo-card__content todo-card__content--clickable"
                  @click="toggleTodoCompleted(todo, !todo.completed)"
                >
                  <p
                    class="todo-card__title"
                    :class="{
                      'todo-card__title--completed': todo.completed,
                    }"
                  >
                    {{ todo.title }}
                  </p>

                  <p v-if="todo.dueDate" class="todo-card__due">
                    <v-icon
                      icon="mdi-calendar-clock"
                      size="14"
                      :class="{ 'todo-overdue': isTodoOverdue(todo) }"
                    />
                    <span :class="{ 'todo-overdue': isTodoOverdue(todo) }">
                      Due {{ formatDueDate(todo.dueDate) }}
                    </span>
                  </p>
                </div>

                <div class="todo-card__actions">
                  <v-btn
                    icon="mdi-pencil"
                    variant="text"
                    color="primary"
                    size="small"
                    aria-label="Edit todo"
                    @click="openEditTodoDialog(todo)"
                  />
                  <v-btn
                    icon="mdi-delete"
                    variant="text"
                    color="error"
                    size="small"
                    aria-label="Delete todo"
                    @click="openDeleteTodoDialog(todo)"
                  />
                </div>
              </div>
            </v-card>
          </div>
        </v-card-text>

        <v-divider />

        <v-card-actions class="px-6 py-4">
          <v-spacer />
          <v-btn variant="text" @click="closeItemsDialog">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="createDialogOpen" max-width="480">
      <v-card class="dashboard-dialog" rounded="lg">
        <v-card-title class="dashboard-dialog__title px-6 pt-6">New list</v-card-title>
        <v-card-text class="px-6">
          <v-form ref="createForm" @submit.prevent="handleCreateList">
            <v-text-field
              v-model="newListName"
              label="List name"
              prepend-inner-icon="mdi-format-list-bulleted"
              density="comfortable"
              :rules="listNameRules"
              autofocus
            />
            <v-alert
              v-if="dialogError"
              type="error"
              variant="tonal"
              density="comfortable"
              class="mt-2"
              icon="mdi-alert-circle-outline"
              border="start"
            >
              {{ dialogError }}
            </v-alert>
          </v-form>
        </v-card-text>
        <v-card-actions class="px-6 pb-6">
          <v-spacer />
          <v-btn variant="text" @click="closeCreateDialog">Cancel</v-btn>
          <v-btn
            color="primary"
            variant="elevated"
            class="oc-cta"
            :loading="createLoading"
            @click="handleCreateList"
          >
            Create
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="renameDialogOpen" max-width="480">
      <v-card class="dashboard-dialog" rounded="lg">
        <v-card-title class="dashboard-dialog__title px-6 pt-6">Rename list</v-card-title>
        <v-card-text class="px-6">
          <v-form ref="renameForm" @submit.prevent="handleRenameList">
            <v-text-field
              v-model="renameListName"
              label="List name"
              prepend-inner-icon="mdi-pencil-outline"
              density="comfortable"
              :rules="listNameRules"
              autofocus
            />
            <v-alert
              v-if="dialogError"
              type="error"
              variant="tonal"
              density="comfortable"
              class="mt-2"
              icon="mdi-alert-circle-outline"
              border="start"
            >
              {{ dialogError }}
            </v-alert>
          </v-form>
        </v-card-text>
        <v-card-actions class="px-6 pb-6">
          <v-spacer />
          <v-btn variant="text" @click="closeRenameDialog">Cancel</v-btn>
          <v-btn
            color="primary"
            variant="elevated"
            :loading="renameLoading"
            @click="handleRenameList"
          >
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="deleteDialogOpen" max-width="480">
      <v-card class="dashboard-dialog" rounded="lg">
        <v-card-title class="dashboard-dialog__title px-6 pt-6">Delete list</v-card-title>
        <v-card-text class="px-6">
          Are you sure you want to delete
          <strong>{{ listToDelete?.name }}</strong>?
        </v-card-text>
        <v-card-actions class="px-6 pb-6">
          <v-spacer />
          <v-btn variant="text" @click="closeDeleteDialog">Cancel</v-btn>
          <v-btn
            color="error"
            variant="elevated"
            :loading="deleteLoading"
            @click="handleDeleteList"
          >
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="addTodoDialogOpen" max-width="480">
      <v-card class="dashboard-dialog" rounded="lg">
        <v-card-title class="dashboard-dialog__title px-6 pt-6">Add item</v-card-title>
        <v-card-text class="px-6">
          <v-form ref="addTodoForm" @submit.prevent="handleAddTodo">
            <v-text-field
              v-model="newTodoTitle"
              label="Todo title"
              prepend-inner-icon="mdi-checkbox-marked-circle-outline"
              density="comfortable"
              :rules="todoTitleRules"
              autofocus
            />
            <v-text-field
              v-model="newTodoDueDate"
              label="Due date"
              type="date"
              prepend-inner-icon="mdi-calendar"
              density="comfortable"
              :rules="dueDateRules"
            />
            <v-alert
              v-if="todoDialogError"
              type="error"
              variant="tonal"
              density="comfortable"
              class="mt-2"
              icon="mdi-alert-circle-outline"
              border="start"
            >
              {{ todoDialogError }}
            </v-alert>
          </v-form>
        </v-card-text>
        <v-card-actions class="px-6 pb-6">
          <v-spacer />
          <v-btn variant="text" @click="closeAddTodoDialog">Cancel</v-btn>
          <v-btn
            color="primary"
            variant="elevated"
            class="oc-cta"
            :loading="addTodoLoading"
            @click="handleAddTodo"
          >
            Add
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="editTodoDialogOpen" max-width="480">
      <v-card class="dashboard-dialog" rounded="lg">
        <v-card-title class="dashboard-dialog__title px-6 pt-6">Edit item</v-card-title>
        <v-card-text class="px-6">
          <v-form ref="editTodoForm" @submit.prevent="handleEditTodo">
            <v-text-field
              v-model="editTodoTitle"
              label="Todo title"
              prepend-inner-icon="mdi-checkbox-marked-circle-outline"
              density="comfortable"
              :rules="todoTitleRules"
              autofocus
            />
            <v-text-field
              v-model="editTodoDueDate"
              label="Due date"
              type="date"
              prepend-inner-icon="mdi-calendar"
              density="comfortable"
              :rules="dueDateRules"
              clearable
            />
            <v-alert
              v-if="todoDialogError"
              type="error"
              variant="tonal"
              density="comfortable"
              class="mt-2"
              icon="mdi-alert-circle-outline"
              border="start"
            >
              {{ todoDialogError }}
            </v-alert>
          </v-form>
        </v-card-text>
        <v-card-actions class="px-6 pb-6">
          <v-spacer />
          <v-btn variant="text" @click="closeEditTodoDialog">Cancel</v-btn>
          <v-btn
            color="primary"
            variant="elevated"
            :loading="editTodoLoading"
            @click="handleEditTodo"
          >
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="deleteTodoDialogOpen" max-width="480">
      <v-card class="dashboard-dialog" rounded="lg">
        <v-card-title class="dashboard-dialog__title px-6 pt-6">Delete item</v-card-title>
        <v-card-text class="px-6">
          Are you sure you want to delete
          <strong>{{ todoToDelete?.title }}</strong>?
        </v-card-text>
        <v-card-actions class="px-6 pb-6">
          <v-spacer />
          <v-btn variant="text" @click="closeDeleteTodoDialog">Cancel</v-btn>
          <v-btn
            color="error"
            variant="elevated"
            :loading="deleteTodoLoading"
            @click="handleDeleteTodo"
          >
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.dashboard-page {
  min-height: 100%;
  background:
    linear-gradient(180deg, rgba(128, 19, 40, 0.04) 0%, rgba(249, 249, 255, 1) 28%),
    rgb(var(--v-theme-surface));
}

.dashboard-page__container {
  max-width: 920px;
}

.dashboard-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.dashboard-welcome__time {
  margin: 0 0 6px;
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(128, 19, 40, 0.72);
}

.dashboard-welcome__title {
  margin: 0;
  font-size: clamp(1.6rem, 2.8vw, 2.1rem);
  font-weight: 700;
  line-height: 1.15;
  color: rgb(var(--v-theme-on-surface));
}

.dashboard-welcome__title span {
  color: rgb(var(--v-theme-primary));
}

.dashboard-welcome__message {
  margin: 10px 0 0;
  font-size: 1rem;
  line-height: 1.5;
  color: rgba(28, 27, 31, 0.68);
}

.dashboard-section__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: rgb(var(--v-theme-primary));
}

.dashboard-header__subtitle {
  margin: 6px 0 0;
  color: rgba(28, 27, 31, 0.68);
}

.dashboard-header__cta {
  flex-shrink: 0;
}

.dashboard-empty__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: rgb(var(--v-theme-primary-container));
}

.list-grid {
  display: grid;
  gap: 12px;
}

.list-card {
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.list-card--clickable {
  cursor: pointer;
}

.list-card--clickable:hover {
  box-shadow: 0 6px 16px rgba(128, 19, 40, 0.12);
}

.list-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(128, 19, 40, 0.1);
}

.list-card--complete {
  border: 1px solid rgba(46, 125, 50, 0.22);
}

.list-card--overdue {
  border: 1px solid rgba(179, 38, 30, 0.28);
}

.list-card__due {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: rgb(var(--v-theme-primary));
}

.list-card__due--overdue {
  color: rgb(var(--v-theme-error));
}

.list-card__body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
}

.list-card__info {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  flex: 1;
}

.list-card__info--preview {
  cursor: pointer;
  border-radius: 10px;
  padding: 4px 6px;
  margin: -4px -6px;
  transition: background-color 0.15s ease;
}

.list-card__info--preview:hover {
  background: rgba(128, 19, 40, 0.06);
}

.list-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgb(var(--v-theme-primary-container));
  flex-shrink: 0;
}

.list-card__icon--complete {
  background: rgba(46, 125, 50, 0.12);
}

.list-card__text {
  min-width: 0;
}

.list-card__name {
  display: block;
  font-size: 1.05rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-card__status {
  display: block;
  margin-top: 2px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: rgb(var(--v-theme-primary));
}

.list-card__status--complete {
  color: rgb(var(--v-theme-success));
}

.list-card__status--empty {
  color: rgba(28, 27, 31, 0.45);
}

.list-card__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.list-preview {
  border: 1px solid rgba(128, 19, 40, 0.12);
  overflow: hidden;
}

.list-preview__header {
  padding: 14px 16px 10px;
}

.list-preview__title {
  font-size: 1rem;
  font-weight: 700;
  color: rgb(var(--v-theme-primary));
  padding: 0;
}

.list-preview__subtitle {
  opacity: 0.75;
  padding: 0;
}

.list-preview__body {
  padding: 12px 16px;
}

.list-preview__empty {
  margin: 0;
  font-size: 0.875rem;
  color: rgba(28, 27, 31, 0.55);
}

.list-preview__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.list-preview__item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.list-preview__item--completed .list-preview__item-title {
  text-decoration: line-through;
  color: rgba(28, 27, 31, 0.5);
}

.list-preview__check {
  flex-shrink: 0;
}

.list-preview__check :deep(.v-selection-control__input > .v-icon) {
  color: rgb(var(--v-theme-primary)) !important;
  opacity: 1 !important;
  font-size: 22px;
}

.list-preview__check :deep(.v-selection-control__input::before) {
  opacity: 0 !important;
}

.list-preview__content {
  min-width: 0;
}

.list-preview__content--clickable {
  cursor: pointer;
}

.list-preview__content--clickable:hover .list-preview__item-title {
  color: rgb(var(--v-theme-primary));
}

.list-preview__item-title {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.35;
  color: rgb(var(--v-theme-on-surface));
}

.list-preview__due {
  display: block;
  margin-top: 2px;
  font-size: 0.75rem;
  color: rgba(28, 27, 31, 0.55);
}

.list-preview__more {
  margin: 10px 0 0;
  font-size: 0.8125rem;
  font-weight: 500;
  color: rgb(var(--v-theme-primary));
}

.list-preview__footer {
  background: rgba(128, 19, 40, 0.04);
}

.list-preview__hint {
  font-size: 0.75rem;
  color: rgba(28, 27, 31, 0.5);
}

.dashboard-dialog__header {
  padding: 20px 24px 16px;
}

.dashboard-dialog__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgb(var(--v-theme-primary-container));
}

.dashboard-dialog__title {
  font-weight: 700;
  color: rgb(var(--v-theme-primary));
}

.dashboard-dialog__body {
  padding: 20px 24px;
}

.todo-list {
  display: grid;
  gap: 10px;
}

.todo-card {
  border-color: rgba(128, 19, 40, 0.12) !important;
  background: rgb(var(--v-theme-surface));
}

.todo-card--completed {
  opacity: 0.82;
  background: rgba(231, 224, 225, 0.35);
}

.todo-card__body {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
}

.todo-card__checkbox {
  margin-top: 2px;
  flex-shrink: 0;
}

.todo-card__checkbox :deep(.v-selection-control__input > .v-icon) {
  color: rgb(var(--v-theme-primary)) !important;
  opacity: 1 !important;
  font-size: 26px;
}

.todo-card__checkbox :deep(.v-selection-control__input::before) {
  opacity: 0 !important;
}

.todo-card__content {
  flex: 1;
  min-width: 0;
}

.todo-card__content--clickable {
  cursor: pointer;
}

.todo-card__content--clickable:hover .todo-card__title:not(.todo-card__title--completed) {
  color: rgb(var(--v-theme-primary));
}

.todo-card__title {
  margin: 0;
  font-size: 0.98rem;
  font-weight: 500;
  line-height: 1.4;
  color: rgb(var(--v-theme-on-surface));
}

.todo-card__title--completed {
  text-decoration: line-through;
  color: rgba(28, 27, 31, 0.55);
}

.todo-card__due {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 4px 0 0;
  font-size: 0.82rem;
  color: rgba(28, 27, 31, 0.62);
}

.todo-overdue {
  color: rgb(var(--v-theme-error)) !important;
}

.todo-card__actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

@media (max-width: 600px) {
  .dashboard-header__cta {
    width: 100%;
  }

  .list-card__body {
    align-items: flex-start;
    flex-direction: column;
  }

  .list-card__actions {
    align-self: flex-end;
  }
}
</style>
