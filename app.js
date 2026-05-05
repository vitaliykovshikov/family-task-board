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
const adminAuthForm = document.querySelector("#adminAuthForm");
const authError = document.querySelector("#authError");
const tabs = document.querySelectorAll("[data-filter]");
const mainTabs = document.querySelectorAll("[data-view]");
const resetDemoButton = document.querySelector("#resetDemo");
const adminOnlyElements = document.querySelectorAll("[data-admin-only]");

const remote = {
  client: null,
  enabled: false,
  syncInProgress: false,
  adminSession: null,
  adminAllowed: false,
};

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

  const name = requestedUser.trim();
  if (!name) return;

  if (name.toLowerCase() === "admin") {
    state.currentUserId = "user_admin_1";
    state.selectedUserId = "user_admin_1";
    return;
  }

  const userId = userIdFromName(name);
  let user = state.users.find((item) => item.id === userId);

  if (!user) {
    user = {
      id: userId,
      name,
      role: "member",
      completedTasksCount: 0,
      balance: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.users.push(user);
  } else if (user.name !== name) {
    user.name = name;
    user.updatedAt = nowIso();
  }

  state.currentUserId = userId;
  state.selectedUserId = userId;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  syncRemoteState();
}

function currentUser() {
  return state.users.find((user) => user.id === state.currentUserId);
}

function isAdmin() {
  if (currentUser()?.role !== "admin") return false;
  return !remote.enabled || remote.adminAllowed;
}

function isAdminRoute() {
  return currentUser()?.role === "admin";
}

function selectedUser() {
  return state.users.find((user) => user.id === state.selectedUserId) || currentUser();
}

function userName(userId) {
  return state.users.find((user) => user.id === userId)?.name || "Невідомо";
}

function userUrlValue(user) {
  if (user.id === "user_admin_1") return "admin";
  return encodeURIComponent(user.name);
}

function userIdFromName(name) {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9а-яіїєґ]+/gi, "_")
    .replace(/^_+|_+$/g, "");

  return `user_${slug || createId("member")}`;
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
  document.body.classList.toggle("child-mode", !isAdminRoute());
  document.querySelector("h1").textContent = isAdminRoute()
    ? "Сімейна дошка завдань"
    : `Привіт, ${user.name}, ось твої завдання`;
  document.querySelector("#userName").textContent = user.name;
  document.querySelector("#userRole").textContent = user.role;
  document.querySelector("#completedCount").textContent = user.completedTasksCount;
  document.querySelector("#balance").textContent = user.balance;
  document.querySelector("#userUrlHint").textContent = `?user=${userUrlValue(user)}`;
  adminOnlyElements.forEach((element) => {
    element.hidden = !isAdmin();
  });
  adminAuthForm.hidden = !isAdminRoute() || !remote.enabled || Boolean(remote.adminSession);
}

function renderTasks() {
  const tasks = state.tasks
    .filter((task) => {
      if (isAdminRoute()) return activeFilter === "all" || task.status === activeFilter;
      return ["available", "in_progress", "done"].includes(task.status);
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (tasks.length === 0) {
    taskList.innerHTML = '<div class="empty-state">Тут поки немає завдань</div>';
    return;
  }

  taskList.innerHTML = tasks.map(renderTaskCard).join("");
}

function renderTaskCard(task) {
  if (!isAdminRoute()) return renderChildTaskCard(task);

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

function renderChildTaskCard(task) {
  const details = task.details ? `<p class="details">${escapeHtml(task.details)}</p>` : "";
  const recurrence =
    task.recurrence && task.recurrence !== "none"
      ? `<span class="meta-item">${recurrenceLabels[task.recurrence]}</span>`
      : "";
  const started = task.startedAt
    ? `<span class="meta-item">В роботі: ${formatElapsed(task.startedAt)}</span>`
    : "";
  const ownedByOther =
    task.assignedToUserId && task.assignedToUserId !== currentUser().id
      ? `<span class="meta-item">Взяв: ${escapeHtml(userName(task.assignedToUserId))}</span>`
      : "";

  return `
    <article class="task-card child-task-card status-${task.status}" data-task-id="${task.id}">
      <div class="task-header">
        <h3 class="task-title">${escapeHtml(task.title)}</h3>
      </div>
      <div class="child-reward">${task.reward}</div>
      ${details}
      <div class="task-meta">
        <span class="meta-item">${remainingText(task.dueAt)}</span>
        ${recurrence}
        ${started}
        ${ownedByOther}
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
            <span class="muted">${user.role} · ?user=${escapeHtml(userUrlValue(user))}</span>
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
  document.querySelector("#balanceEditorSlot").innerHTML = renderBalanceEditor(user);

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

function renderBalanceEditor(user) {
  if (!isAdmin() || user.role === "admin") return "";

  return `
    <form class="balance-editor" data-balance-user-id="${user.id}">
      <label>
        Валюта користувача
        <input name="balance" type="number" step="1" value="${user.balance}" />
      </label>
      <button class="primary" type="submit">Оновити валюту</button>
    </form>
  `;
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
  if (event.type === "manual_adjustment") return "Корекція адміном";
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

async function initializeRemote() {
  const config = window.APP_CONFIG || {};
  if (!config.supabaseUrl || !config.supabaseAnonKey || !window.supabase) return;

  remote.client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  remote.enabled = true;

  const {
    data: { session },
  } = await remote.client.auth.getSession();
  remote.adminSession = session;
  remote.adminAllowed = await checkAdminAllowed();

  remote.client.auth.onAuthStateChange(async (_event, sessionValue) => {
    remote.adminSession = sessionValue;
    remote.adminAllowed = await checkAdminAllowed();
    rerender();
  });

  await loadRemoteState();
}

async function checkAdminAllowed() {
  if (!remote.enabled || !remote.adminSession) return false;

  const { data, error } = await remote.client.from("app_admins").select("email").limit(1);
  return !error && Boolean(data?.length);
}

async function loadRemoteState() {
  if (!remote.enabled) return;

  const [usersResult, tasksResult, rewardsResult, rewardTxResult, purchaseTxResult] = await Promise.all([
    remote.client.from("users").select("*"),
    remote.client.from("tasks").select("*"),
    remote.client.from("rewards").select("*"),
    remote.client.from("reward_transactions").select("*"),
    remote.client.from("purchase_transactions").select("*"),
  ]);

  const results = [usersResult, tasksResult, rewardsResult, rewardTxResult, purchaseTxResult];
  const failed = results.find((result) => result.error);
  if (failed) {
    console.warn("Supabase load failed, using local fallback", failed.error);
    return;
  }

  const hasRemoteData = results.some((result) => result.data?.length);
  if (!hasRemoteData) return;

  state = normalizeState({
    ...state,
    users: usersResult.data.map(userFromDb),
    tasks: tasksResult.data.map(taskFromDb),
    rewards: rewardsResult.data.map(rewardFromDb),
    rewardTransactions: rewardTxResult.data.map(rewardTransactionFromDb),
    purchaseTransactions: purchaseTxResult.data.map(purchaseTransactionFromDb),
  });
}

function syncRemoteState() {
  if (!remote.enabled || remote.syncInProgress) return;

  remote.syncInProgress = true;
  Promise.allSettled([
    state.users.length ? remote.client.from("users").upsert(state.users.map(userToDb)) : null,
    state.tasks.length ? remote.client.from("tasks").upsert(state.tasks.map(taskToDb)) : null,
    state.rewards.length ? remote.client.from("rewards").upsert(state.rewards.map(rewardToDb)) : null,
    state.rewardTransactions.length
      ? remote.client.from("reward_transactions").upsert(state.rewardTransactions.map(rewardTransactionToDb))
      : null,
    state.purchaseTransactions.length
      ? remote.client.from("purchase_transactions").upsert(state.purchaseTransactions.map(purchaseTransactionToDb))
      : null,
  ])
    .then((results) => {
      results.forEach((result) => {
        if (result.status === "fulfilled" && result.value?.error) {
          console.warn("Supabase sync warning", result.value.error);
        }
      });
    })
    .finally(() => {
      remote.syncInProgress = false;
    });
}

function userToDb(user) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    completed_tasks_count: user.completedTasksCount,
    balance: user.balance,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  };
}

function userFromDb(row) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    completedTasksCount: row.completed_tasks_count,
    balance: row.balance,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function taskToDb(task) {
  return {
    id: task.id,
    title: task.title,
    reward: task.reward,
    details: task.details || null,
    deadline_amount: task.deadlineAmount,
    deadline_unit: task.deadlineUnit,
    due_at: task.dueAt,
    requires_approval: task.requiresApproval,
    recurrence: task.recurrence,
    status: task.status,
    created_by_user_id: task.createdByUserId,
    assigned_to_user_id: task.assignedToUserId,
    completed_by_user_id: task.completedByUserId,
    approved_by_user_id: task.approvedByUserId,
    created_at: task.createdAt,
    started_at: task.startedAt,
    completed_at: task.completedAt,
    approved_at: task.approvedAt,
    updated_at: task.updatedAt,
  };
}

function taskFromDb(row) {
  return {
    id: row.id,
    title: row.title,
    reward: row.reward,
    details: row.details || "",
    deadlineAmount: row.deadline_amount,
    deadlineUnit: row.deadline_unit,
    dueAt: row.due_at,
    requiresApproval: row.requires_approval,
    recurrence: row.recurrence,
    status: row.status,
    createdByUserId: row.created_by_user_id,
    assignedToUserId: row.assigned_to_user_id,
    completedByUserId: row.completed_by_user_id,
    approvedByUserId: row.approved_by_user_id,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    approvedAt: row.approved_at,
    updatedAt: row.updated_at,
  };
}

function rewardToDb(reward) {
  return {
    id: reward.id,
    title: reward.title,
    description: reward.description || null,
    cost: reward.cost,
    stock: reward.stock,
    purchased_count: reward.purchasedCount,
    available_amount: reward.availableAmount,
    available_unit: reward.availableUnit,
    available_until: reward.availableUntil,
    per_user_limit: reward.perUserLimit,
    created_by_user_id: reward.createdByUserId,
    created_at: reward.createdAt,
    updated_at: reward.updatedAt,
  };
}

function rewardFromDb(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    cost: row.cost,
    stock: row.stock,
    purchasedCount: row.purchased_count,
    availableAmount: row.available_amount,
    availableUnit: row.available_unit,
    availableUntil: row.available_until,
    perUserLimit: row.per_user_limit,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rewardTransactionToDb(transaction) {
  return {
    id: transaction.id,
    user_id: transaction.userId,
    task_id: transaction.taskId,
    amount: transaction.amount,
    type: transaction.type,
    created_by_user_id: transaction.createdByUserId,
    created_at: transaction.createdAt,
  };
}

function rewardTransactionFromDb(row) {
  return {
    id: row.id,
    userId: row.user_id,
    taskId: row.task_id,
    amount: row.amount,
    type: row.type,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
  };
}

function purchaseTransactionToDb(transaction) {
  return {
    id: transaction.id,
    user_id: transaction.userId,
    reward_id: transaction.rewardId,
    amount: transaction.amount,
    type: transaction.type,
    created_at: transaction.createdAt,
  };
}

function purchaseTransactionFromDb(row) {
  return {
    id: row.id,
    userId: row.user_id,
    rewardId: row.reward_id,
    amount: row.amount,
    type: row.type,
    createdAt: row.created_at,
  };
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

adminAuthForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!remote.enabled) return;

  authError.textContent = "";
  const formData = new FormData(adminAuthForm);
  const { error } = await remote.client.auth.signInWithPassword({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (error) {
    authError.textContent = "Не вдалося увійти. Перевір email і пароль.";
    return;
  }

  adminAuthForm.reset();
  await initializeRemote();
  if (!remote.adminAllowed) {
    authError.textContent = "Цей акаунт не доданий у app_admins.";
    await remote.client.auth.signOut();
    return;
  }
  applyCurrentUserFromUrl();
  rerender();
});

document.querySelector("#userRole").addEventListener("dblclick", async () => {
  if (!remote.enabled || !remote.adminSession) return;
  await remote.client.auth.signOut();
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

document.querySelector("#usersView").addEventListener("submit", (event) => {
  const form = event.target.closest("[data-balance-user-id]");
  if (!form || !isAdmin()) return;

  event.preventDefault();
  const user = state.users.find((item) => item.id === form.dataset.balanceUserId);
  const nextBalance = Number(new FormData(form).get("balance"));
  if (!user || !Number.isFinite(nextBalance)) return;

  const delta = nextBalance - user.balance;
  user.balance = nextBalance;
  user.updatedAt = nowIso();

  if (delta !== 0) {
    state.rewardTransactions.push({
      id: createId("reward_tx"),
      userId: user.id,
      taskId: null,
      amount: delta,
      type: "manual_adjustment",
      createdByUserId: currentUser().id,
      createdAt: nowIso(),
    });
  }

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

async function startApp() {
  await initializeRemote();
  applyCurrentUserFromUrl();
  rerender();
  saveState();
}

startApp();
