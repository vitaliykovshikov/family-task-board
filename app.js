const STORAGE_KEY = "family-task-board-v2";
const LEGACY_STORAGE_KEY = "family-task-board-v1";

const statusLabels = {
  available: "Доступне",
  in_progress: "В процесі",
  done: "На апрув",
  approved: "Завершене",
};

const recurrenceLabels = {
  none: "Без повтору",
  daily: "Щодня",
  weekly: "Щотижня",
  monthly: "Щомісяця",
};

const unitLabels = {
  day: ["день", "дні", "днів"],
  week: ["тиждень", "тижні", "тижнів"],
  month: ["місяць", "місяці", "місяців"],
};

const seedState = {
  currentUserId: "user_admin_1",
  selectedUserId: "user_admin_1",
  users: [
    {
      id: "user_admin_1",
      name: "Адмін",
      role: "admin",
      completedTasksCount: 0,
      balance: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "user_child_1",
      name: "Дитина",
      role: "member",
      completedTasksCount: 0,
      balance: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  tasks: [],
  rewards: [],
  rewardTransactions: [],
  purchaseTransactions: [],
};

let state = loadState();
let activeFilter = "all";
let activeView = "tasks";

const taskForm = document.querySelector("#taskForm");
const rewardForm = document.querySelector("#rewardForm");
const taskList = document.querySelector("#taskList");
const rewardList = document.querySelector("#rewardList");
const usersList = document.querySelector("#usersList");
const tabs = document.querySelectorAll("[data-filter]");
const mainTabs = document.querySelectorAll("[data-view]");
const resetDemoButton = document.querySelector("#resetDemo");
const adminOnlyElements = document.querySelectorAll("[data-admin-only]");

applyCurrentUserFromUrl();

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return structuredClone(seedState);

  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return structuredClone(seedState);
  }
}

function normalizeState(nextState) {
  const usersById = new Map(structuredClone(seedState.users).map((user) => [user.id, user]));
  (nextState.users || []).forEach((user) => usersById.set(user.id, user));

  const normalized = {
    ...structuredClone(seedState),
    ...nextState,
    users: Array.from(usersById.values()),
    tasks: nextState.tasks || [],
    rewards: nextState.rewards || [],
    rewardTransactions: nextState.rewardTransactions || [],
    purchaseTransactions: nextState.purchaseTransactions || [],
  };

  normalized.selectedUserId = normalized.selectedUserId || normalized.currentUserId;
  if (!normalized.users.some((user) => user.id === normalized.currentUserId)) {
    normalized.currentUserId = seedState.currentUserId;
  }
  if (!normalized.users.some((user) => user.id === normalized.selectedUserId)) {
    normalized.selectedUserId = normalized.currentUserId;
  }
  normalized.tasks = normalized.tasks.map((task) => {
    const deadlineAmount = task.deadlineAmount || (task.timeLimitMinutes ? 1 : 1);
    const deadlineUnit = task.deadlineUnit || "day";
    return {
      ...task,
      deadlineAmount,
      deadlineUnit,
      dueAt: task.dueAt || addDuration(task.createdAt || nowIso(), deadlineAmount, deadlineUnit),
      assignedToUserId: task.assignedToUserId || null,
      startedAt: task.startedAt || null,
      completedByUserId: task.completedByUserId || null,
      approvedByUserId: task.approvedByUserId || null,
    };
  });

  return normalized;
}

function applyCurrentUserFromUrl() {
  const requestedUser = new URLSearchParams(window.location.search).get("user");
  if (!requestedUser) return;

  const aliases = {
    admin: "user_admin_1",
    child: "user_child_1",
    kid: "user_child_1",
    member: "user_child_1",
  };
  const userId = aliases[requestedUser] || requestedUser;

  if (state.users.some((user) => user.id === userId)) {
    state.currentUserId = userId;
    state.selectedUserId = userId;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function currentUser() {
  return state.users.find((user) => user.id === state.currentUserId);
}

function isAdmin() {
  return currentUser()?.role === "admin";
}

function selectedUser() {
  return state.users.find((user) => user.id === state.selectedUserId) || currentUser();
}

function userName(userId) {
  return state.users.find((user) => user.id === userId)?.name || "Невідомо";
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function nowIso() {
  return new Date().toISOString();
}

function addDuration(baseIso, amount, unit) {
  const date = new Date(baseIso);
  const value = Number(amount);

  if (unit === "day") date.setDate(date.getDate() + value);
  if (unit === "week") date.setDate(date.getDate() + value * 7);
  if (unit === "month") date.setMonth(date.getMonth() + value);

  return date.toISOString();
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDuration(amount, unit) {
  const forms = unitLabels[unit] || unitLabels.day;
  const value = Number(amount);
  const mod10 = value % 10;
  const mod100 = value % 100;
  let form = forms[2];

  if (mod10 === 1 && mod100 !== 11) form = forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) form = forms[1];

  return `${value} ${form}`;
}

function formatElapsed(fromIso, toIso = nowIso()) {
  if (!fromIso) return "";

  const diffMs = Math.max(0, new Date(toIso) - new Date(fromIso));
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days} д ${hours} год`;
  if (hours > 0) return `${hours} год ${minutes} хв`;
  return `${minutes} хв`;
}

function remainingText(toIso) {
  const diffMs = new Date(toIso) - new Date();
  const prefix = diffMs >= 0 ? "Залишилось" : "Прострочено на";
  return `${prefix}: ${formatElapsed(diffMs >= 0 ? nowIso() : toIso, diffMs >= 0 ? toIso : nowIso())}`;
}

function renderUser() {
  const user = currentUser();
  document.querySelector("#userName").textContent = user.name;
  document.querySelector("#userRole").textContent = user.role;
  document.querySelector("#completedCount").textContent = user.completedTasksCount;
  document.querySelector("#balance").textContent = user.balance;
  document.querySelector("#userUrlHint").textContent = user.id === "user_admin_1" ? "?user=admin" : "?user=child";
  adminOnlyElements.forEach((element) => {
    element.hidden = !isAdmin();
  });
}

function renderTasks() {
  const tasks = state.tasks
    .filter((task) => activeFilter === "all" || task.status === activeFilter)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (tasks.length === 0) {
    taskList.innerHTML = '<div class="empty-state">Тут поки немає завдань</div>';
    return;
  }

  taskList.innerHTML = tasks.map(renderTaskCard).join("");
}

function renderTaskCard(task) {
  const details = task.details ? `<p class="details">${escapeHtml(task.details)}</p>` : "";
  const approval = task.requiresApproval ? "Потрібен апрув" : "Автоапрув";
  const assignee = task.assignedToUserId
    ? `<span class="meta-item">Взяв: ${escapeHtml(userName(task.assignedToUserId))}</span>`
    : "";
  const started = task.startedAt
    ? `<span class="meta-item">В роботі: ${formatElapsed(task.startedAt)}</span>`
    : "";
  const completed = task.completedAt
    ? `<span class="meta-item">Виконано: ${formatDate(task.completedAt)}</span>`
    : "";

  return `
    <article class="task-card" data-task-id="${task.id}">
      <div class="task-header">
        <h3 class="task-title">${escapeHtml(task.title)}</h3>
        <span class="status-pill status-${task.status}">${statusLabels[task.status]}</span>
      </div>
      ${details}
      <div class="task-meta">
        <span class="meta-item">Нагорода: ${task.reward}</span>
        <span class="meta-item">Дедлайн: ${formatDuration(task.deadlineAmount, task.deadlineUnit)}</span>
        <span class="meta-item">${remainingText(task.dueAt)}</span>
        <span class="meta-item">${approval}</span>
        <span class="meta-item">${recurrenceLabels[task.recurrence]}</span>
        ${assignee}
        ${started}
        ${completed}
      </div>
      <div class="task-actions">
        ${renderTaskActions(task)}
      </div>
    </article>
  `;
}

function renderTaskActions(task) {
  if (task.status === "available") {
    return `<button class="primary" type="button" data-task-action="start">Взяти</button>`;
  }

  if (task.status === "in_progress" && task.assignedToUserId === currentUser().id) {
    return `<button class="primary" type="button" data-task-action="complete">Позначити виконаним</button>`;
  }

  if (task.status === "done" && isAdmin()) {
    return `
      <button class="primary" type="button" data-task-action="approve">Апрувити</button>
      <button class="secondary" type="button" data-task-action="return">Повернути в роботу</button>
    `;
  }

  return "";
}

function renderRewards() {
  document.querySelector("#shopSummary").textContent = `Баланс: ${currentUser().balance}`;

  if (state.rewards.length === 0) {
    rewardList.innerHTML = '<div class="empty-state">У магазині поки немає нагород</div>';
    return;
  }

  rewardList.innerHTML = state.rewards
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(renderRewardCard)
    .join("");
}

function renderRewardCard(reward) {
  const boughtByUser = state.purchaseTransactions.filter(
    (purchase) => purchase.rewardId === reward.id && purchase.userId === currentUser().id,
  ).length;
  const isExpired = new Date(reward.availableUntil) < new Date();
  const isSoldOut = reward.purchasedCount >= reward.stock;
  const limitReached = boughtByUser >= reward.perUserLimit;
  const canBuy = !isExpired && !isSoldOut && !limitReached && currentUser().balance >= reward.cost;
  const description = reward.description ? `<p class="details">${escapeHtml(reward.description)}</p>` : "";
  const disabledReason = getRewardDisabledReason({ isExpired, isSoldOut, limitReached, reward });

  return `
    <article class="task-card reward-card" data-reward-id="${reward.id}">
      <div class="task-header">
        <h3 class="task-title">${escapeHtml(reward.title)}</h3>
        <span class="status-pill status-available">${reward.cost}</span>
      </div>
      ${description}
      <div class="task-meta">
        <span class="meta-item">Залишок: ${Math.max(0, reward.stock - reward.purchasedCount)} з ${reward.stock}</span>
        <span class="meta-item">Ліміт: ${reward.perUserLimit} на користувача</span>
        <span class="meta-item">Куплено вами: ${boughtByUser}</span>
        <span class="meta-item">Доступно до: ${formatDate(reward.availableUntil)}</span>
      </div>
      <div class="task-actions">
        <button class="primary" type="button" data-reward-action="buy" ${canBuy ? "" : "disabled"}>
          Купити
        </button>
        ${canBuy ? "" : `<span class="muted action-note">${disabledReason}</span>`}
      </div>
    </article>
  `;
}

function getRewardDisabledReason({ isExpired, isSoldOut, limitReached, reward }) {
  if (isExpired) return "Недоступно за часом";
  if (isSoldOut) return "Закінчилось";
  if (limitReached) return "Досягнуто ліміт";
  if (currentUser().balance < reward.cost) return "Недостатньо валюти";
  return "";
}

function renderUsers() {
  usersList.innerHTML = state.users
    .map((user) => {
      const isSelected = user.id === selectedUser().id;
      return `
        <button class="user-row ${isSelected ? "active" : ""}" type="button" data-user-id="${user.id}">
          <span>
            <strong>${escapeHtml(user.name)}</strong>
            <span class="muted">${user.role} · ${user.id === "user_admin_1" ? "?user=admin" : "?user=child"}</span>
          </span>
          <span class="balance-chip">${user.balance}</span>
        </button>
      `;
    })
    .join("");

  renderSelectedUser();
}

function renderSelectedUser() {
  const user = selectedUser();
  const assignedTasks = state.tasks.filter((task) => task.assignedToUserId === user.id);
  const approvedTasks = state.tasks.filter((task) => task.completedByUserId === user.id && task.status === "approved");
  const purchases = state.purchaseTransactions.filter((purchase) => purchase.userId === user.id);
  const currencyEvents = [
    ...state.rewardTransactions.filter((tx) => tx.userId === user.id).map((tx) => ({ ...tx, direction: "plus" })),
    ...purchases.map((tx) => ({ ...tx, amount: -tx.amount, direction: "minus" })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  document.querySelector("#selectedUserTitle").textContent = user.name;
  document.querySelector("#selectedUserMeta").textContent = user.role;
  document.querySelector("#selectedUserStats").innerHTML = `
    <div class="stat-card"><span class="muted">Баланс</span><strong>${user.balance}</strong></div>
    <div class="stat-card"><span class="muted">Виконано</span><strong>${user.completedTasksCount}</strong></div>
    <div class="stat-card"><span class="muted">В роботі/історія</span><strong>${assignedTasks.length}</strong></div>
    <div class="stat-card"><span class="muted">Покупки</span><strong>${purchases.length}</strong></div>
  `;

  document.querySelector("#userTaskHistory").innerHTML = renderHistory(
    assignedTasks
      .slice()
      .sort((a, b) => new Date(b.startedAt || b.createdAt) - new Date(a.startedAt || a.createdAt))
      .map((task) => `
        <div class="history-item">
          <strong>${escapeHtml(task.title)}</strong>
          <span>${statusLabels[task.status]} · ${task.startedAt ? `взяв ${formatDate(task.startedAt)}` : "ще не взяв"}</span>
        </div>
      `),
    "Немає завдань",
  );

  document.querySelector("#userPurchaseHistory").innerHTML = renderHistory(
    purchases
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((purchase) => `
        <div class="history-item">
          <strong>${escapeHtml(rewardTitle(purchase.rewardId))}</strong>
          <span>-${purchase.amount} · ${formatDate(purchase.createdAt)}</span>
        </div>
      `),
    "Немає покупок",
  );

  document.querySelector("#userCurrencyHistory").innerHTML = renderHistory(
    currencyEvents.map((event) => `
      <div class="history-item">
        <strong>${event.amount > 0 ? "+" : ""}${event.amount}</strong>
        <span>${currencyEventLabel(event)} · ${formatDate(event.createdAt)}</span>
      </div>
    `),
    "Немає руху валюти",
  );
}

function renderHistory(items, emptyText) {
  return items.length ? items.join("") : `<div class="empty-state compact">${emptyText}</div>`;
}

function rewardTitle(rewardId) {
  return state.rewards.find((reward) => reward.id === rewardId)?.title || "Нагорода";
}

function taskTitle(taskId) {
  return state.tasks.find((task) => task.id === taskId)?.title || "Завдання";
}

function currencyEventLabel(event) {
  if (event.type === "task_reward") return taskTitle(event.taskId);
  if (event.type === "reward_purchase") return rewardTitle(event.rewardId);
  return event.type;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function rerender() {
  renderUser();
  renderTasks();
  renderRewards();
  renderUsers();
  saveState();
}

function addTask(formData) {
  if (!isAdmin()) return;

  const user = currentUser();
  const createdAt = nowIso();
  const deadlineAmount = Number(formData.get("deadlineAmount"));
  const deadlineUnit = formData.get("deadlineUnit");

  state.tasks.push({
    id: createId("task"),
    title: formData.get("title").trim(),
    reward: Number(formData.get("reward")),
    details: formData.get("details").trim(),
    deadlineAmount,
    deadlineUnit,
    dueAt: addDuration(createdAt, deadlineAmount, deadlineUnit),
    requiresApproval: formData.get("requiresApproval") === "on",
    recurrence: formData.get("recurrence"),
    status: "available",
    createdByUserId: user.id,
    assignedToUserId: null,
    completedByUserId: null,
    approvedByUserId: null,
    createdAt,
    startedAt: null,
    completedAt: null,
    approvedAt: null,
    updatedAt: createdAt,
  });
}

function addReward(formData) {
  if (!isAdmin()) return;

  const createdAt = nowIso();
  const availableAmount = Number(formData.get("availableAmount"));
  const availableUnit = formData.get("availableUnit");

  state.rewards.push({
    id: createId("shop_reward"),
    title: formData.get("title").trim(),
    description: formData.get("description").trim(),
    cost: Number(formData.get("cost")),
    stock: Number(formData.get("stock")),
    purchasedCount: 0,
    availableAmount,
    availableUnit,
    availableUntil: addDuration(createdAt, availableAmount, availableUnit),
    perUserLimit: Number(formData.get("perUserLimit")),
    createdByUserId: currentUser().id,
    createdAt,
    updatedAt: createdAt,
  });
}

function updateTask(taskId, updater) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return;
  updater(task);
  task.updatedAt = nowIso();
}

function approveTask(task) {
  if (task.status === "approved") return;

  const user = state.users.find((item) => item.id === task.completedByUserId);
  if (!user) return;

  task.status = "approved";
  task.approvedByUserId = currentUser().id;
  task.approvedAt = nowIso();

  state.rewardTransactions.push({
    id: createId("reward_tx"),
    userId: user.id,
    taskId: task.id,
    amount: task.reward,
    type: "task_reward",
    createdByUserId: currentUser().id,
    createdAt: nowIso(),
  });

  user.balance += task.reward;
  user.completedTasksCount += 1;
  user.updatedAt = nowIso();
}

function buyReward(rewardId) {
  const reward = state.rewards.find((item) => item.id === rewardId);
  const user = currentUser();
  if (!reward || !user) return;

  const boughtByUser = state.purchaseTransactions.filter(
    (purchase) => purchase.rewardId === reward.id && purchase.userId === user.id,
  ).length;

  if (new Date(reward.availableUntil) < new Date()) return;
  if (reward.purchasedCount >= reward.stock) return;
  if (boughtByUser >= reward.perUserLimit) return;
  if (user.balance < reward.cost) return;

  user.balance -= reward.cost;
  user.updatedAt = nowIso();
  reward.purchasedCount += 1;
  reward.updatedAt = nowIso();

  state.purchaseTransactions.push({
    id: createId("purchase_tx"),
    userId: user.id,
    rewardId: reward.id,
    amount: reward.cost,
    type: "reward_purchase",
    createdAt: nowIso(),
  });
}

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(taskForm);
  const title = formData.get("title").trim();
  const reward = Number(formData.get("reward"));
  const deadlineAmount = Number(formData.get("deadlineAmount"));

  if (!title || !Number.isFinite(reward) || reward <= 0 || deadlineAmount <= 0) return;

  addTask(formData);
  taskForm.reset();
  taskForm.elements.reward.value = 10;
  taskForm.elements.deadlineAmount.value = 1;
  taskForm.elements.requiresApproval.checked = true;
  rerender();
});

rewardForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(rewardForm);
  const title = formData.get("title").trim();
  const cost = Number(formData.get("cost"));
  const stock = Number(formData.get("stock"));
  const perUserLimit = Number(formData.get("perUserLimit"));

  if (!title || cost <= 0 || stock <= 0 || perUserLimit <= 0) return;

  addReward(formData);
  rewardForm.reset();
  rewardForm.elements.cost.value = 20;
  rewardForm.elements.stock.value = 1;
  rewardForm.elements.availableAmount.value = 1;
  rewardForm.elements.perUserLimit.value = 1;
  rerender();
});

taskList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-task-action]");
  if (!button) return;

  const card = button.closest("[data-task-id]");
  const taskId = card.dataset.taskId;
  const action = button.dataset.taskAction;

  updateTask(taskId, (task) => {
    if (action === "start") {
      task.status = "in_progress";
      task.assignedToUserId = currentUser().id;
      task.startedAt = nowIso();
    }

    if (action === "complete" && task.assignedToUserId === currentUser().id) {
      task.completedByUserId = currentUser().id;
      task.completedAt = nowIso();

      if (task.requiresApproval) {
        task.status = "done";
      } else {
        approveTask(task);
      }
    }

    if (action === "approve" && isAdmin()) {
      approveTask(task);
    }

    if (action === "return" && isAdmin()) {
      task.status = "in_progress";
      task.completedAt = null;
      task.completedByUserId = null;
    }
  });

  rerender();
});

rewardList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-reward-action='buy']");
  if (!button) return;

  const card = button.closest("[data-reward-id]");
  buyReward(card.dataset.rewardId);
  rerender();
});

usersList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-user-id]");
  if (!button) return;

  state.selectedUserId = button.dataset.userId;
  rerender();
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    activeFilter = tab.dataset.filter;
    tabs.forEach((item) => item.classList.toggle("active", item === tab));
    renderTasks();
  });
});

mainTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    activeView = tab.dataset.view;
    mainTabs.forEach((item) => item.classList.toggle("active", item === tab));
    document.querySelectorAll(".view").forEach((view) => {
      view.classList.toggle("active", view.id === `${activeView}View`);
    });
  });
});

resetDemoButton.addEventListener("click", () => {
  state = structuredClone(seedState);
  taskForm.reset();
  rewardForm.reset();
  taskForm.elements.reward.value = 10;
  taskForm.elements.deadlineAmount.value = 1;
  taskForm.elements.requiresApproval.checked = true;
  rewardForm.elements.cost.value = 20;
  rewardForm.elements.stock.value = 1;
  rewardForm.elements.availableAmount.value = 1;
  rewardForm.elements.perUserLimit.value = 1;
  rerender();
});

setInterval(() => {
  if (activeView === "tasks") renderTasks();
}, 60000);

rerender();
