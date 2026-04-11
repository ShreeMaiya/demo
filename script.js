const API_URL = "/api/todos";
const ANALYTICS_URL = "/api/analytics";
const COUNTER_URL = "/api/counter";
const THEME_KEY = "todo-theme";
const SECTION_KEY = "todo-active-section";
const ANALYTICS_REFRESH_INTERVAL_MS = 2000;
const ANALYTICS_REFRESH_DELAY_MS = 1200;

// Todo section elements.
const form = document.getElementById("todo-form");
const input = document.getElementById("todo-input");
const list = document.getElementById("todo-list");
const message = document.getElementById("message");
const analyticsStatus = document.getElementById("analytics-status");
const analyticsCounts = document.getElementById("analytics-counts");
const analyticsEvents = document.getElementById("analytics-events");
const analyticsRefresh = document.getElementById("analytics-refresh");
const counterValue = document.getElementById("counter-value");
const counterMessage = document.getElementById("counter-message");
const counterIncrement = document.getElementById("counter-increment");
const counterReset = document.getElementById("counter-reset");
const sectionTabs = Array.from(document.querySelectorAll("[data-section-tab]"));
const sectionPanels = Array.from(document.querySelectorAll("[data-section-panel]"));
const hasTodoUI = Boolean(form && input && list && message);
const hasAnalyticsUI = Boolean(analyticsStatus && analyticsCounts && analyticsEvents);
const hasCounterUI = Boolean(counterValue && counterMessage && counterIncrement && counterReset);
const hasSectionUI = sectionTabs.length > 0 && sectionPanels.length > 0;

// Shared global controls.
const themeToggle = document.getElementById("theme-toggle");

let scrollStateTimer;
let analyticsRefreshTimer;
let toastContainer;

// ===== Shared UI Helpers =====

// Create a single toast host and reuse it for all notifications.
function getToastContainer() {
  if (toastContainer) {
    return toastContainer;
  }

  toastContainer = document.createElement("div");
  toastContainer.className = "toast-container";
  toastContainer.setAttribute("aria-live", "polite");
  toastContainer.setAttribute("aria-atomic", "true");
  document.body.appendChild(toastContainer);
  return toastContainer;
}

// Create a transient toast message for success, error, and info states.
function showToast(text, type = "info") {
  const container = getToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = text;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.remove();
    }, 220);
  }, 2100);
}

function updateListScrollState() {
  if (!list) {
    return;
  }

  clearTimeout(scrollStateTimer);

  // Delay and threshold prevent one-frame scrollbar flicker during list reflow.
  scrollStateTimer = setTimeout(() => {
    const overflowDelta = list.scrollHeight - list.clientHeight;
    const hasOverflow = overflowDelta > 10;
    list.classList.toggle("is-scrollable", hasOverflow);
  }, 90);
}

// Persist and apply the selected theme across reloads.
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  if (themeToggle) {
    themeToggle.setAttribute(
      "aria-label",
      theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
    );
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  const theme = savedTheme || "dark";
  applyTheme(theme);
}

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, nextTheme);
    applyTheme(nextTheme);
  });
}

function setMessage(text, isError = false) {
  if (!message) {
    return;
  }

  message.textContent = text;
  message.classList.toggle("error", Boolean(text) && isError);
}

function setAnalyticsStatus(text, isError = false) {
  if (!analyticsStatus) {
    return;
  }

  analyticsStatus.textContent = text;
  analyticsStatus.classList.toggle("error", Boolean(text) && isError);
}

function setCounterMessage(text, isError = false) {
  if (!counterMessage) {
    return;
  }

  counterMessage.textContent = text;
  counterMessage.classList.toggle("error", Boolean(text) && isError);
}

function scheduleAnalyticsRefresh(delay = ANALYTICS_REFRESH_DELAY_MS) {
  if (!analyticsCounts || !analyticsEvents) {
    return;
  }

  clearTimeout(analyticsRefreshTimer);
  analyticsRefreshTimer = setTimeout(() => {
    loadAnalytics();
  }, delay);
}

function syncTodoListViewport() {
  if (!list) {
    return;
  }

  requestAnimationFrame(() => {
    updateListScrollState();
  });
}

function setActiveSection(sectionName, persist = true) {
  if (!hasSectionUI) {
    return;
  }

  const availableSections = new Set(sectionPanels.map((panel) => panel.dataset.sectionPanel));
  const nextSection = availableSections.has(sectionName)
    ? sectionName
    : sectionPanels[0]?.dataset.sectionPanel;

  for (const panel of sectionPanels) {
    const isActive = panel.dataset.sectionPanel === nextSection;
    panel.hidden = !isActive;
    panel.classList.toggle("is-active", isActive);
  }

  for (const tab of sectionTabs) {
    const isActive = tab.dataset.sectionTab === nextSection;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-pressed", String(isActive));
  }

  if (persist && nextSection) {
    localStorage.setItem(SECTION_KEY, nextSection);
  }
}

function initSectionSwitcher() {
  if (!hasSectionUI) {
    return;
  }

  const defaultSection = document.body.dataset.defaultSection || sectionPanels[0]?.dataset.sectionPanel || "todos";
  const savedSection = localStorage.getItem(SECTION_KEY);
  setActiveSection(savedSection || defaultSection, false);

  for (const tab of sectionTabs) {
    tab.addEventListener("click", () => {
      setActiveSection(tab.dataset.sectionTab);
    });
  }
}

// ===== Todo Logic =====

// Todo row and its checkbox/delete actions.
function createTodoElement(todo, index) {
  const li = document.createElement("li");
  li.className = `todo-item${todo.completed ? " completed" : ""}`;
  li.style.setProperty("--i", String(index));

  const checkboxWrap = document.createElement("label");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = Boolean(todo.completed);
  checkbox.addEventListener("change", async () => {
    await toggleTodo(todo.id, checkbox.checked);
  });
  checkboxWrap.appendChild(checkbox);

  const title = document.createElement("span");
  title.className = "todo-title";
  title.textContent = todo.title;

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "delete-btn";
  deleteBtn.type = "button";
  deleteBtn.textContent = "Delete";
  deleteBtn.addEventListener("click", async () => {
    await deleteTodo(todo.id);
  });

  li.append(checkboxWrap, title, deleteBtn);
  return li;
}

// Render full Todo list state, including an empty-state row.
function renderTodos(todos) {
  if (!list) {
    return;
  }

  list.innerHTML = "";
  list.classList.remove("is-scrollable");

  if (!todos.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No todos yet. Add your first task.";
    list.appendChild(empty);
    return;
  }

  for (const [index, todo] of todos.entries()) {
    list.appendChild(createTodoElement(todo, index));
  }

  updateListScrollState();
}

// JSON request helper used by Todo endpoints.
async function request(url, options = {}) {
  async function fetchOnce() {
    return fetch(url, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      ...options
    });
  }

  async function parseResponse(response) {
    const contentType = response.headers.get("content-type") || "";
    const payloadText = await response.text();

    if (!payloadText) {
      if (response.ok) {
        return {};
      }

      throw new Error("Empty response from server.");
    }

    if (!contentType.includes("application/json")) {
      const isLikelyTransient = response.status >= 500 || payloadText.includes("<html") || payloadText.includes("<!DOCTYPE html");
      if (isLikelyTransient) {
        throw new Error("Temporary server response.");
      }

      throw new Error("Invalid JSON response from server.");
    }

    let data;
    try {
      data = JSON.parse(payloadText);
    } catch {
      throw new Error("Invalid JSON response from server.");
    }

    if (!response.ok) {
      throw new Error(data.error || "Request failed.");
    }

    return data;
  }

  const retryDelays = [250, 500, 1000, 1500, 2000];
  let lastError;

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      const response = await fetchOnce();
      return await parseResponse(response);
    } catch (error) {
      lastError = error;

      if (error.message !== "Temporary server response." || attempt === retryDelays.length) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
    }
  }

  throw lastError || new Error("Request failed.");
}

// Fetch and paint latest Todo data from the backend.
async function loadTodos() {
  if (!hasTodoUI) {
    return;
  }

  try {
    setMessage("Loading todos...");
    const data = await request(API_URL);
    renderTodos(data.todos || []);
    setMessage("");
  } catch (err) {
    setMessage(err.message, true);
  }
}

function renderAnalyticsCounts(counts) {
  if (!analyticsCounts) {
    return;
  }

  const cards = [
    { label: "Created", value: counts["todo.created"] || 0 },
    { label: "Updated", value: counts["todo.updated"] || 0 },
    { label: "Deleted", value: counts["todo.deleted"] || 0 }
  ];

  analyticsCounts.innerHTML = cards
    .map(
      (card) => `
        <div class="analytics-card">
          <span class="analytics-card-label">${card.label}</span>
          <span class="analytics-card-value">${card.value}</span>
        </div>
      `
    )
    .join("");
}

function renderAnalyticsEvents(events) {
  if (!analyticsEvents) {
    return;
  }

  if (!events.length) {
    analyticsEvents.innerHTML = `
      <li class="empty">No analytics events yet. Perform a todo action to generate queue data.</li>
    `;
    return;
  }

  analyticsEvents.innerHTML = events
    .map((event) => {
      const eventLabel = {
        "todo.created": "Created",
        "todo.updated": "Updated",
        "todo.deleted": "Deleted"
      }[event.event_type] || event.event_type;

      const occurredAt = new Date(event.occurred_at).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
      });

      const todoTitle = event.todo_title || event.payload?.title || `Todo #${event.todo_id ?? "-"}`;
      const completionState =
        event.todo_completed === null || event.todo_completed === undefined
          ? ""
          : event.todo_completed
            ? "Completed"
            : "Pending";

      return `
        <li class="analytics-event">
          <div class="analytics-event-type">${eventLabel}</div>
          <div class="analytics-event-meta">
            <div>${todoTitle}</div>
            <div>Todo #${event.todo_id ?? "-"}${completionState ? ` · ${completionState}` : ""}</div>
            <div>${occurredAt}</div>
          </div>
        </li>
      `;
    })
    .join("");
}

async function loadAnalytics() {
  if (!analyticsCounts || !analyticsEvents) {
    return;
  }

  try {
    setAnalyticsStatus("Loading queue events...");
    const data = await request(ANALYTICS_URL);
    renderAnalyticsCounts(data.counts || {});
    renderAnalyticsEvents(data.recent_events || []);
    setAnalyticsStatus("Showing queue-processed analytics events.");
    syncTodoListViewport();
  } catch (err) {
    analyticsCounts.innerHTML = "";
    analyticsEvents.innerHTML = `
      <li class="empty">Unable to load analytics right now.</li>
    `;
    setAnalyticsStatus(err.message, true);
    syncTodoListViewport();
  }
}

function renderCounter(value) {
  if (!counterValue) {
    return;
  }

  counterValue.textContent = String(value);
}

async function loadCounter() {
  if (!hasCounterUI) {
    return;
  }

  try {
    setCounterMessage("Loading counter...");
    const data = await request(COUNTER_URL);
    renderCounter(data.value ?? 0);
    setCounterMessage("Counter synced.");
  } catch (err) {
    setCounterMessage(err.message, true);
    showToast(err.message, "error");
  }
}

async function updateCounter(method, body, successMessage) {
  try {
    const data = await request(COUNTER_URL, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });

    renderCounter(data.value ?? 0);
    setCounterMessage(successMessage);
    showToast(successMessage, "success");
  } catch (err) {
    setCounterMessage(err.message, true);
    showToast(err.message, "error");
  }
}

async function addTodo(title) {
  await request(API_URL, {
    method: "POST",
    body: JSON.stringify({ title })
  });
}

async function toggleTodo(id, completed) {
  try {
    await request(API_URL, {
      method: "PUT",
      body: JSON.stringify({ id, completed })
    });
    await loadTodos();
    scheduleAnalyticsRefresh();
    showToast(completed ? "Task marked as done." : "Task marked as pending.", "success");
  } catch (err) {
    setMessage(err.message, true);
    showToast(err.message, "error");
    await loadTodos();
  }
}

async function deleteTodo(id) {
  try {
    await request(`${API_URL}?id=${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
    await loadTodos();
    scheduleAnalyticsRefresh();
    showToast("Task removed.", "success");
  } catch (err) {
    setMessage(err.message, true);
    showToast(err.message, "error");
  }
}

if (form) {
  form.addEventListener("submit", async (event) => {
    // Todo submit pipeline: validate, create, refresh list, notify.
    event.preventDefault();
    const title = input.value.trim();

    if (!title) {
      setMessage("Todo title is required.", true);
      return;
    }

    try {
      await addTodo(title);
      input.value = "";
      setMessage("Todo added.");
      await loadTodos();
      scheduleAnalyticsRefresh();
      showToast("Task added.", "success");
    } catch (err) {
      setMessage(err.message, true);
      showToast(err.message, "error");
    }
  });
}

initTheme();
initSectionSwitcher();
if (hasTodoUI) {
  loadTodos();
  window.addEventListener("resize", updateListScrollState);
}

if (hasAnalyticsUI) {
  loadAnalytics();

  setInterval(() => {
    loadAnalytics();
  }, ANALYTICS_REFRESH_INTERVAL_MS);
}

if (hasCounterUI) {
  loadCounter();

  counterIncrement.addEventListener("click", async () => {
    await updateCounter("POST", { delta: 1 }, "Counter incremented.");
  });

  counterReset.addEventListener("click", async () => {
    await updateCounter("DELETE", undefined, "Counter reset.");
  });
}

if (analyticsRefresh) {
  analyticsRefresh.addEventListener("click", () => {
    loadAnalytics();
  });
}
