const STORAGE_KEY = "myuno_admin_session";
const DEFAULT_API_BASE = "http://localhost:2567/api";
const PAGE_SIZE = 30;

const navItems = [
  { id: "dashboard", label: "仪表盘" },
  { id: "users", label: "玩家" },
  { id: "redeems", label: "兑换码" },
  { id: "mail", label: "邮件" },
  { id: "online", label: "在线" },
  { id: "audit", label: "审计" },
  { id: "items", label: "物品" },
  { id: "settlement", label: "日榜" },
];

const app = document.querySelector("#app");
const saved = readJson(localStorage.getItem(STORAGE_KEY), {});

const state = {
  apiBase: normalizeApiBase(saved.apiBase || DEFAULT_API_BASE),
  token: saved.token || "",
  user: saved.user || null,
  view: "dashboard",
  message: "",
  error: "",
  userQuery: "",
  selectedUser: null,
  selectedUserDetail: null,
  selectedRedeemUses: null,
  selectedRedeemCodeId: null,
  userDetailTab: "overview",
  mailTab: "compose",
  mailStatus: "all",
  auditPage: 1,
  auditFilters: {
    type: "",
    actorUserId: "",
    targetUserId: "",
  },
  mailHistoryPage: 1,
  userEventPage: 1,
  redeemUsesPage: 1,
  shopItems: [],
};

function readJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeApiBase(value) {
  return String(value || DEFAULT_API_BASE).trim().replace(/\/+$/, "");
}

function saveSession() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    apiBase: state.apiBase,
    token: state.token,
    user: state.user,
  }));
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
  state.token = "";
  state.user = null;
  state.selectedUser = null;
  state.selectedUserDetail = null;
}

function html(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function number(value) {
  return Number(value || 0).toLocaleString();
}

function shortDate(value) {
  if (!value) return "-";
  const date = typeof value === "number" ? new Date(value) : new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 19);
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function intValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function rowsOf(value, key = "rows") {
  if (Array.isArray(value)) return value;
  return Array.isArray(value?.[key]) ? value[key] : [];
}

function totalOf(value, key = "rows") {
  if (Array.isArray(value)) return value.length;
  return Number(value?.total ?? rowsOf(value, key).length ?? 0);
}

function renderPagination(data, key) {
  const total = totalOf(data, key === "redeem-uses" ? "uses" : "rows");
  const pageSize = Number(data?.pageSize || PAGE_SIZE);
  const page = Number(data?.page || 1);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) {
    return `<div class="subtle" style="margin-top:10px;">共 ${number(total)} 条</div>`;
  }
  return `
    <div class="toolbar" style="margin-top:12px;">
      <span class="subtle">第 ${number(page)} / ${number(totalPages)} 页，共 ${number(total)} 条</span>
      <div class="actions">
        <button class="btn btn-small" data-page-key="${key}" data-page="${page - 1}" type="button" ${page <= 1 ? "disabled" : ""}>上一页</button>
        <button class="btn btn-small" data-page-key="${key}" data-page="${page + 1}" type="button" ${page >= totalPages ? "disabled" : ""}>下一页</button>
      </div>
    </div>
  `;
}

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  let response;
  try {
    response = await fetch(`${state.apiBase}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    throw new Error(
      `无法连接 API。请检查 API 地址、HTTPS 证书、反向代理，以及 server 的 CLIENT_ORIGIN 是否包含当前 Admin 域名。原始错误：${error?.message || "Failed to fetch"}`
    );
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error || response.statusText || "Request failed";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

function setMessage(message, error = "") {
  state.message = message || "";
  state.error = error || "";
  const target = document.querySelector("#notice-slot");
  if (target) target.innerHTML = renderNotice();
}

function renderNotice() {
  if (state.error) return `<div class="notice error">${html(state.error)}</div>`;
  if (state.message) return `<div class="notice">${html(state.message)}</div>`;
  return "";
}

function render() {
  if (!state.token) {
    renderLogin();
    return;
  }
  renderShell();
  loadView(state.view);
}

function renderLogin() {
  app.innerHTML = `
    <main class="login-page">
      <form class="login-box" id="login-form">
        <h1 class="brand">Card Party Admin</h1>
        <p class="subtle">独立后台管理入口。请使用管理员或 root 账号登录。</p>
        <div id="notice-slot">${renderNotice()}</div>
        <div class="field">
          <label for="api-base">API 地址</label>
          <input class="input" id="api-base" name="apiBase" value="${html(state.apiBase)}" autocomplete="url" />
        </div>
        <div class="field">
          <label for="account">账号</label>
          <input class="input" id="account" name="account" autocomplete="username" autofocus />
        </div>
        <div class="field">
          <label for="password">密码</label>
          <input class="input" id="password" name="password" type="password" autocomplete="current-password" />
        </div>
        <div class="actions">
          <button class="btn btn-primary" type="submit">登录后台</button>
        </div>
      </form>
    </main>
  `;
}

function renderShell() {
  const title = navItems.find((item) => item.id === state.view)?.label || "后台";
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div>
          <h1 class="brand">Card Party Admin</h1>
          <div class="subtle mono">${html(state.apiBase)}</div>
        </div>
        <nav class="nav">
          ${navItems.map((item) => `
            <button class="btn ${state.view === item.id ? "active" : ""}" data-nav="${item.id}" type="button">${item.label}</button>
          `).join("")}
        </nav>
        <div class="side-foot">
          <div class="subtle">
            当前账号<br />
            <strong>${html(state.user?.nickname || state.user?.account || state.user?.username || "Admin")}</strong>
          </div>
          <button class="btn" data-action="logout" type="button">退出登录</button>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div>
            <h1>${title}</h1>
            <div class="subtle">通过 server admin API 管理业务数据</div>
          </div>
          <button class="btn btn-warn" data-action="refresh" type="button">刷新</button>
        </header>
        <section class="content">
          <div id="notice-slot">${renderNotice()}</div>
          <div id="content"><div class="loading">加载中...</div></div>
        </section>
      </main>
    </div>
  `;
}

function setContent(markup) {
  const target = document.querySelector("#content");
  if (target) target.innerHTML = markup;
}

async function loadView(view) {
  setMessage("");
  setContent(`<div class="loading">加载中...</div>`);
  try {
    if (view === "dashboard") await loadDashboard();
    if (view === "users") await loadUsers();
    if (view === "redeems") await loadRedeems();
    if (view === "mail") await loadMail();
    if (view === "online") await loadOnline();
    if (view === "audit") await loadAudit();
    if (view === "items") await loadItems();
    if (view === "settlement") await loadSettlement();
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      clearSession();
      state.error = error.status === 403 ? "当前账号没有管理员权限。" : "登录已失效，请重新登录。";
      renderLogin();
      return;
    }
    setContent(`<div class="notice error">${html(error.message)}</div>`);
  }
}

async function ensureShopItems() {
  if (state.shopItems.length) return state.shopItems;
  state.shopItems = await request("/admin/shop-items");
  return state.shopItems;
}

async function loadDashboard() {
  const [summary, online, redeems, mails] = await Promise.all([
    request("/admin/summary"),
    request("/admin/online-users"),
    request("/admin/redeem-codes?limit=8"),
    request("/admin/mail?limit=8"),
  ]);
  const stats = [
    ["用户", summary.users],
    ["在线", online.length],
    ["总金币", summary.totalCoins],
    ["总积分", summary.totalPoints],
    ["兑换码", summary.redeemCodes],
    ["兑换次数", summary.redeemUses],
    ["邮件", summary.mailMessages],
    ["流水", summary.accountEvents],
    ["日榜结算", summary.dailySettlements],
  ];
  setContent(`
    <div class="grid stats">
      ${stats.map(([label, value]) => `
        <div class="stat"><span>${label}</span><strong>${number(value)}</strong></div>
      `).join("")}
    </div>
    <div class="grid split" style="margin-top:16px;">
      <section class="panel">
        <h2>最近兑换码</h2>
        ${renderRedeemTable(redeems, true)}
      </section>
      <section class="panel">
        <h2>最近邮件</h2>
        ${renderMailHistoryTable(mails, true)}
      </section>
    </div>
  `);
}

async function loadUsers(query = state.userQuery) {
  state.userQuery = query || "";
  const suffix = state.userQuery ? `?query=${encodeURIComponent(state.userQuery)}` : "";
  const users = await request(`/admin/users${suffix}`);
  setContent(`
    <div class="toolbar">
      <form id="user-search-form">
        <div class="field" style="margin-top:0;">
          <label for="user-query">搜索账号 / 昵称 / ID</label>
          <input class="input" id="user-query" name="query" value="${html(state.userQuery)}" />
        </div>
        <button class="btn btn-primary" type="submit">搜索</button>
      </form>
      <span class="pill">${users.length} 个结果</span>
    </div>
    <div class="split">
      <section>
        ${renderUsersTable(users)}
      </section>
      <aside class="panel" id="user-detail">
        <div class="subtle">选择左侧玩家查看和编辑资料。</div>
      </aside>
    </div>
  `);
}

function renderUsersTable(users) {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th><th>账号</th><th>昵称</th><th>金币</th><th>积分</th><th>权限</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${users.map((user) => `
            <tr>
              <td class="mono">${user.id}</td>
              <td>${html(user.account || user.username)}</td>
              <td>${html(user.nickname || "-")}</td>
              <td>${number(user.coins)}</td>
              <td>${number(user.points)}</td>
              <td>${user.is_admin ? `<span class="pill">Admin</span>` : `<span class="muted">Player</span>`}</td>
              <td><button class="btn btn-small" data-user-id="${user.id}" type="button">详情</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function loadUserDetail(userId) {
  const id = Number(userId);
  state.userEventPage = 1;
  const users = await request(`/admin/users?query=${encodeURIComponent(String(id))}`);
  const user = users.find((entry) => Number(entry.id) === id) || users[0];
  if (!user) throw new Error("用户不存在");
  const [inventory, redeems, mail, events, games, presence] = await Promise.all([
    request(`/admin/users/${id}/inventory`),
    request(`/admin/users/${id}/redeems?limit=20`),
    request(`/admin/users/${id}/mail?limit=20`),
    request(`/admin/users/${id}/events?page=1&pageSize=${PAGE_SIZE}`),
    request(`/admin/users/${id}/games?limit=10`),
    request(`/admin/users/${id}/presence`),
  ]);
  await ensureShopItems();
  state.selectedUser = user;
  state.selectedUserDetail = { inventory, redeems, mail, events, games, presence };
  const target = document.querySelector("#user-detail");
  if (target) target.innerHTML = renderUserDetail(user, state.selectedUserDetail);
}

async function loadUserEventsPage(page) {
  if (!state.selectedUser || !state.selectedUserDetail) return;
  const nextPage = Math.max(1, intValue(page, 1));
  state.userEventPage = nextPage;
  state.selectedUserDetail.events = await request(
    `/admin/users/${state.selectedUser.id}/events?page=${nextPage}&pageSize=${PAGE_SIZE}`
  );
  const target = document.querySelector("#user-detail");
  if (target) target.innerHTML = renderUserDetail(state.selectedUser, state.selectedUserDetail);
}

function renderUserDetail(user, detail) {
  const presence = detail.presence || {};
  const tabs = [
    ["overview", "概览"],
    ["inventory", `背包 ${detail.inventory.length}`],
    ["mail", `邮件 ${detail.mail.length}`],
    ["redeems", `兑换 ${detail.redeems.length}`],
    ["games", `对局 ${detail.games.length}`],
    ["events", `流水 ${totalOf(detail.events)}`],
  ];
  return `
    <div class="detail-head">
      <div>
        <h2>${html(user.nickname || user.account || user.username)}</h2>
        <p class="subtle mono">#${user.id} / ${html(user.account || user.username)}</p>
      </div>
      <div class="actions">
        ${renderPresencePill(presence)}
        ${user.is_admin ? `<span class="pill">Admin</span>` : `<span class="pill">Player</span>`}
      </div>
    </div>
    <div class="detail-tabs">
      ${tabs.map(([id, label]) => `
        <button class="btn btn-small ${state.userDetailTab === id ? "active" : ""}" data-user-detail-tab="${id}" type="button">${label}</button>
      `).join("")}
    </div>
    ${renderUserDetailBody(user, detail)}
  `;
}

function renderPresencePill(presence) {
  if (!presence?.online) return `<span class="pill muted">离线</span>`;
  const labels = { lobby: "在线大厅", room: "游戏中", reconnecting: "重连中" };
  return `<span class="pill">${html(labels[presence.status] || "在线")}</span>`;
}

function renderUserDetailBody(user, detail) {
  if (state.userDetailTab === "inventory") return renderUserInventoryPanel(user, detail.inventory);
  if (state.userDetailTab === "mail") return renderUserMailPanel(user, detail.mail);
  if (state.userDetailTab === "redeems") return renderUserRedeemsPanel(detail.redeems);
  if (state.userDetailTab === "games") return renderUserGamesPanel(detail.games);
  if (state.userDetailTab === "events") return renderUserEventsPanel(detail.events);
  return renderUserOverviewPanel(user, detail);
}

function renderUserOverviewPanel(user, detail) {
  const presence = detail.presence || {};
  const statusLabels = { lobby: "大厅", room: "房间中", reconnecting: "重连中", offline: "离线" };
  const roomText = presence.roomName || presence.roomId || "-";
  return `
    <div class="grid stats">
      <div class="stat"><span>在线状态</span><strong>${html(statusLabels[presence.status] || (presence.online ? "在线" : "离线"))}</strong></div>
      <div class="stat"><span>所在房间</span><strong>${html(roomText)}</strong></div>
      <div class="stat"><span>最近活跃</span><strong>${shortDate(presence.lastActiveAt)}</strong></div>
      <div class="stat"><span>最近登录</span><strong>${shortDate(presence.lastLoginAt || user.last_login_at)}</strong></div>
    </div>
    <hr />
    <form id="user-update-form" data-user-id="${user.id}">
      <div class="form-grid">
        ${field("account", "账号", user.account || user.username)}
        ${field("nickname", "昵称", user.nickname || "")}
        ${field("coins", "金币", user.coins, "number")}
        ${field("points", "积分", user.points, "number")}
        ${field("daily_points", "今日积分", user.daily_points, "number")}
        ${field("level", "等级", user.level, "number")}
      </div>
      <div class="field">
        <label for="is_admin">权限</label>
        <select class="select" id="is_admin" name="is_admin">
          <option value="false" ${user.is_admin ? "" : "selected"}>普通玩家</option>
          <option value="true" ${user.is_admin ? "selected" : ""}>管理员</option>
        </select>
      </div>
      <div class="actions">
        <button class="btn btn-good" type="submit">保存资料</button>
      </div>
    </form>
    <hr />
    <div class="grid stats">
      <div class="stat"><span>背包</span><strong>${number(detail.inventory.length)}</strong></div>
      <div class="stat"><span>兑换</span><strong>${number(detail.redeems.length)}</strong></div>
      <div class="stat"><span>邮件</span><strong>${number(detail.mail.length)}</strong></div>
      <div class="stat"><span>流水</span><strong>${number(totalOf(detail.events))}</strong></div>
    </div>
    <div class="grid summary-grid" style="margin-top:16px;">
      ${renderUserOverviewSummary("最近对局", renderUserGameSummary(detail.games))}
      ${renderUserOverviewSummary("最近资产流水", renderUserEventSummary(detail.events))}
      ${renderUserOverviewSummary("最近邮件", renderUserMailSummary(detail.mail))}
      ${renderUserOverviewSummary("最近兑换", renderUserRedeemSummary(detail.redeems))}
    </div>
  `;
}

function renderUserOverviewSummary(title, body) {
  return `
    <section class="panel compact-panel">
      <h3>${html(title)}</h3>
      ${body}
    </section>
  `;
}

function renderMiniRows(rows, emptyText) {
  if (!rows.length) return `<div class="muted">${html(emptyText)}</div>`;
  return `<div class="mini-list">${rows.join("")}</div>`;
}

function renderUserGameSummary(rows) {
  return renderMiniRows(rows.slice(0, 3).map((row) => `
    <div class="mini-row">
      <span>${row.room_id ? "联机" : "AI"} / ${row.isWin ? "胜利" : "失败"} / ${number(row.selfPoints || 0)} pts</span>
      <span class="muted">${shortDate(row.ended_at)}</span>
    </div>
  `), "暂无对局记录");
}

function renderUserEventSummary(data) {
  const rows = rowsOf(data).slice(0, 4);
  return renderMiniRows(rows.map((row) => `
    <div class="mini-row">
      <span>${html(eventLabel(row.type))} ${eventReward(row)}</span>
      <span class="muted">${shortDate(row.created_at)}</span>
    </div>
  `), "暂无资产流水");
}

function renderUserMailSummary(rows) {
  return renderMiniRows(rows.slice(0, 4).map((mail) => `
    <div class="mini-row">
      <span>${html(mail.title || "-")} / ${mail.claimed_at ? "已领取" : mail.is_read ? "已读" : "未读"}</span>
      <span class="muted">${shortDate(mail.created_at)}</span>
    </div>
  `), "暂无邮件");
}

function renderUserRedeemSummary(rows) {
  return renderMiniRows(rows.slice(0, 4).map((row) => `
    <div class="mini-row">
      <span class="mono">${html(row.code || "-")}</span>
      <span class="muted">${shortDate(row.redeemed_at)}</span>
    </div>
  `), "暂无兑换记录");
}

function renderUserInventoryPanel(user, inventory) {
  return `
    <form id="grant-item-form" data-user-id="${user.id}" class="subform">
      <h3>发放物品</h3>
      <div class="form-grid">
        <div class="field">
          <label for="grant-item-id">物品</label>
          <select class="select" id="grant-item-id" name="itemId">
            ${renderItemOptions()}
          </select>
        </div>
        ${field("quantity", "数量", 1, "number")}
      </div>
      <div class="actions"><button class="btn btn-warn" type="submit">发放物品</button></div>
    </form>
    <form id="grant-custom-title-form" data-user-id="${user.id}" class="subform">
      <h3>发放专属称号</h3>
      <p class="subtle">短标识会生成物品 ID：title_短标识。留空时服务器会自动生成。</p>
      <div class="form-grid three">
        ${field("customTitleKey", "短标识", "")}
        ${field("customTitleZh", "中文称号", "牌桌传说")}
        ${field("customTitleEn", "英文称号", "Table Legend")}
      </div>
      <div class="form-grid three">
        ${field("customTitleIcon", "图标", "★")}
        ${field("customTitleDescZh", "中文描述", "GM 专属发放称号。")}
        ${field("customTitleDescEn", "英文描述", "Exclusive GM-granted title.")}
      </div>
      <label class="field" style="display:flex;flex-direction:row;align-items:center;">
        <input name="equipNow" type="checkbox" checked />
        <span>发放后立即装备</span>
      </label>
      <div class="actions"><button class="btn btn-good" type="submit">发放专属称号</button></div>
    </form>
    ${renderInventoryTable(inventory)}
  `;
}

function renderUserMailPanel(user, mails) {
  return `
    <form id="user-mail-form" data-user-id="${user.id}" class="subform">
      <h3>发送单人邮件</h3>
      ${field("title", "标题", "系统邮件")}
      <div class="field">
        <label for="user-mail-body">正文</label>
        <textarea class="textarea" id="user-mail-body" name="body">奖励已发放，请查收附件。</textarea>
      </div>
      <div class="form-grid three">
        ${field("rewardCoins", "金币", 0, "number")}
        <div class="field">
          <label for="user-mail-item">物品</label>
          <select class="select" id="user-mail-item" name="rewardItemId">
            <option value="">无物品</option>
            ${renderItemOptions()}
          </select>
        </div>
        ${field("rewardQuantity", "数量", 1, "number")}
      </div>
      ${field("expiresAt", "过期时间", "", "datetime-local")}
      <div class="actions"><button class="btn btn-good" type="submit">发送邮件</button></div>
    </form>
    ${renderUserMailTable(mails)}
  `;
}

function renderUserRedeemsPanel(rows) {
  return `
    <div class="table-wrap compact">
      <table>
        <thead><tr><th>兑换码</th><th>奖励</th><th>时间</th></tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td class="mono">${html(row.code)}</td>
              <td>${number(row.reward_coins)} coins${row.reward_item_id ? `<br /><span class="muted">${html(row.reward_item_id)} x${number(row.reward_quantity || 1)}</span>` : ""}</td>
              <td>${shortDate(row.redeemed_at)}</td>
            </tr>
          `).join("") || `<tr><td colspan="3" class="muted">暂无兑换记录</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function renderUserGamesPanel(rows) {
  return `
    <div class="table-wrap compact">
      <table>
        <thead><tr><th>模式</th><th>结果</th><th>积分</th><th>赢家</th><th>结束时间</th></tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${row.room_id ? "联机" : "AI"}</td>
              <td>${row.isWin ? `<span class="pill">胜利</span>` : `<span class="muted">失败</span>`}</td>
              <td>${number(row.selfPoints || 0)}</td>
              <td>${html(row.winner_name || "-")}</td>
              <td>${shortDate(row.ended_at)}</td>
            </tr>
          `).join("") || `<tr><td colspan="5" class="muted">暂无对局记录</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function renderUserEventsPanel(data) {
  const rows = rowsOf(data);
  return `
    <div class="table-wrap compact">
      <table>
        <thead><tr><th>类型</th><th>金币</th><th>物品</th><th>操作人</th><th>时间</th></tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${html(row.type)}</td>
              <td>${Number(row.delta_coins || 0) ? number(row.delta_coins) : "-"}</td>
              <td>${row.item_id ? `${html(row.item_id)} x${number(row.quantity || 1)}` : "-"}</td>
              <td>${html(row.actor_username || row.actor_account || "-")}</td>
              <td>${shortDate(row.created_at)}</td>
            </tr>
          `).join("") || `<tr><td colspan="5" class="muted">暂无流水</td></tr>`}
        </tbody>
      </table>
    </div>
    ${renderPagination(data, "user-events")}
  `;
}

function renderInventoryTable(rows) {
  return `
    <div class="table-wrap compact">
      <table>
        <thead><tr><th>物品</th><th>ID</th><th>类型</th><th>数量</th><th>状态</th></tr></thead>
        <tbody>
          ${rows.map((item) => `
            <tr>
              <td>${html(item.icon || "")} ${html(item.name_zh || item.name_en || item.item_id)}</td>
              <td class="mono">${html(item.item_id)}</td>
              <td>${html(item.type)}</td>
              <td>${number(item.quantity)}</td>
              <td>${item.is_equipped ? `<span class="pill">装备中</span>` : `<span class="muted">-</span>`}</td>
            </tr>
          `).join("") || `<tr><td colspan="5" class="muted">暂无背包数据</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function renderUserMailTable(rows) {
  return `
    <div class="table-wrap compact">
      <table>
        <thead><tr><th>标题</th><th>奖励</th><th>状态</th><th>时间</th></tr></thead>
        <tbody>
          ${rows.map((mail) => `
            <tr>
              <td><strong>${html(mail.title)}</strong><br /><span class="muted">${html(mail.body || "").slice(0, 60)}</span></td>
              <td>${mailReward(mail)}</td>
              <td>${mail.claimed_at ? `<span class="pill">已领取</span>` : mail.is_read ? `<span class="muted">已读</span>` : `<span class="pill">未读</span>`}</td>
              <td>${shortDate(mail.created_at)}</td>
            </tr>
          `).join("") || `<tr><td colspan="4" class="muted">暂无邮件</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function renderItemOptions() {
  return state.shopItems.map((item) => `
    <option value="${html(item.id)}">${html(item.id)} / ${html(item.name_zh || item.name_en || item.type)}</option>
  `).join("");
}

function field(name, label, value, type = "text") {
  return `
    <div class="field">
      <label for="${name}">${label}</label>
      <input class="input" id="${name}" name="${name}" type="${type}" value="${html(value)}" />
    </div>
  `;
}

async function loadRedeems() {
  const [codes, items] = await Promise.all([
    request("/admin/redeem-codes?limit=100"),
    ensureShopItems(),
  ]);
  setContent(`
    <div class="split">
      <section class="panel">
        <h2>创建兑换码</h2>
        <form id="redeem-form">
          <div class="form-grid three">
            ${field("code", "兑换码", "")}
            ${field("rewardCoins", "金币", 100, "number")}
            ${field("maxUses", "可用次数", 1, "number")}
          </div>
          <div class="form-grid three">
            <div class="field">
              <label for="rewardItemId">物品</label>
              <select class="select" id="rewardItemId" name="rewardItemId">
                <option value="">仅金币</option>
                ${items.map((item) => `<option value="${html(item.id)}">${html(item.id)} / ${html(item.name_zh || item.name_en || item.type)}</option>`).join("")}
              </select>
            </div>
            ${field("rewardQuantity", "物品数量", 1, "number")}
            ${field("expiresAt", "过期时间", "", "datetime-local")}
          </div>
          <label class="field" style="display:flex;flex-direction:row;align-items:center;">
            <input name="isActive" type="checkbox" checked />
            <span>创建后立即启用</span>
          </label>
          <div class="actions"><button class="btn btn-danger" type="submit">创建兑换码</button></div>
        </form>
      </section>
      <section>
        ${renderRedeemTable(codes)}
        <div id="redeem-uses">
          ${renderRedeemUsesPanel(state.selectedRedeemUses)}
        </div>
      </section>
    </div>
  `);
}

function renderRedeemTable(codes, compact = false) {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>兑换码</th><th>奖励</th><th>使用</th>${compact ? "" : "<th>最近 / 趋势</th>"}<th>状态</th>${compact ? "" : "<th></th>"}</tr>
        </thead>
        <tbody>
          ${codes.map((code) => {
            const active = code.is_active !== 0 && code.is_active !== false;
            const expired = Boolean(code.expires_at && new Date(code.expires_at).getTime() < Date.now());
            return `
              <tr>
                <td class="mono"><strong>${html(code.code)}</strong></td>
                <td>${number(code.reward_coins)} coins${code.reward_item_id ? `<br /><span class="muted">${html(code.reward_item_id)} x${number(code.reward_quantity || 1)}</span>` : ""}</td>
                <td>${number(code.used_count)} / ${Number(code.max_uses || 0) || "∞"}</td>
                ${compact ? "" : `<td>${redeemTrendSummary(code)}</td>`}
                <td>${!active ? `<span class="pill">停用</span>` : expired ? `<span class="pill">过期</span>` : `<span class="pill">启用</span>`}</td>
                ${compact ? "" : `
                  <td>
                    <button class="btn btn-small" data-redeem-uses-id="${code.id}" type="button">记录</button>
                    <button class="btn btn-small" data-toggle-code="${code.id}" data-active="${active ? "0" : "1"}" type="button">${active ? "停用" : "启用"}</button>
                  </td>
                `}
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function redeemTrendSummary(code) {
  const lastName = code.last_user_nickname || code.last_user_account || code.last_user_username;
  const lastLine = lastName
    ? `${html(lastName)}<br /><span class="muted mono">#${html(code.last_user_id || "-")} / ${shortDate(code.last_redeemed_at)}</span>`
    : `<span class="muted">暂无使用</span>`;
  return `
    ${lastLine}
    <div class="trend-pills">
      <span class="pill">24h ${number(code.uses_24h || 0)}</span>
      <span class="pill">7d ${number(code.uses_7d || 0)}</span>
    </div>
  `;
}

async function loadRedeemUses(codeId, page = 1) {
  const id = Math.max(1, intValue(codeId, 1));
  const nextPage = Math.max(1, intValue(page, 1));
  state.selectedRedeemCodeId = id;
  state.redeemUsesPage = nextPage;
  const data = await request(`/admin/redeem-codes/${id}/uses?page=${nextPage}&pageSize=${PAGE_SIZE}`);
  state.selectedRedeemUses = data;
  const target = document.querySelector("#redeem-uses");
  if (target) target.innerHTML = renderRedeemUsesPanel(data);
}

function renderRedeemUsesPanel(data) {
  if (!data) {
    return `<section class="panel" style="margin-top:14px;"><div class="subtle">选择一个兑换码查看使用记录。</div></section>`;
  }
  const code = data.code || {};
  const uses = rowsOf(data, "uses");
  const total = totalOf(data, "uses");
  return `
    <section class="panel" style="margin-top:14px;">
      <div class="detail-head">
        <div>
          <h2>兑换记录：${html(code.code || "-")}</h2>
          <p class="subtle">已使用 ${number(code.used_count || total)} / ${Number(code.max_uses || 0) || "∞"}</p>
        </div>
        <span class="pill">${number(total)} 条</span>
      </div>
      <div class="table-wrap compact">
        <table>
          <thead><tr><th>玩家</th><th>奖励</th><th>兑换时间</th></tr></thead>
          <tbody>
            ${uses.map((row) => `
              <tr>
                <td>${html(row.nickname || row.account || row.username || "-")}<br /><span class="muted mono">#${html(row.user_id || "-")} / ${html(row.account || "-")}</span></td>
                <td>${number(row.reward_coins || 0)} coins${row.reward_item_id ? `<br /><span class="muted">${html(row.reward_item_id)} x${number(row.reward_quantity || 1)}</span>` : ""}</td>
                <td>${shortDate(row.redeemed_at)}</td>
              </tr>
            `).join("") || `<tr><td colspan="3" class="muted">暂无使用记录</td></tr>`}
          </tbody>
        </table>
      </div>
      ${renderPagination(data, "redeem-uses")}
    </section>
  `;
}

async function loadMail() {
  if (state.mailTab === "history") {
    const mails = await request(
      `/admin/mail?page=${state.mailHistoryPage}&pageSize=${PAGE_SIZE}&status=${encodeURIComponent(state.mailStatus)}`
    );
    setContent(renderMailPage(`${renderMailHistoryTable(mails)}${renderPagination(mails, "mail-history")}`, "history"));
    return;
  }
  const items = await ensureShopItems();
  setContent(renderMailPage(renderMailCompose(items), "compose"));
}

function renderMailPage(body, activeTab) {
  return `
    <div class="subtabs">
      <button class="btn ${activeTab === "compose" ? "active" : ""}" data-mail-tab="compose" type="button">发送全服邮件</button>
      <button class="btn ${activeTab === "history" ? "active" : ""}" data-mail-tab="history" type="button">历史邮件</button>
    </div>
    ${activeTab === "history" ? renderMailStatusTabs() : ""}
    ${body}
  `;
}

function renderMailStatusTabs() {
  const tabs = [
    ["all", "全部"],
    ["unread", "未读"],
    ["unclaimed", "未领取"],
    ["claimed", "已领取"],
    ["expired", "已过期"],
  ];
  return `
    <div class="subtabs compact-tabs">
      ${tabs.map(([id, label]) => `
        <button class="btn btn-small ${state.mailStatus === id ? "active" : ""}" data-mail-status="${id}" type="button">${label}</button>
      `).join("")}
    </div>
  `;
}

function renderMailCompose(items) {
  return `
    <section class="panel">
      <h2>发送全服邮件</h2>
      <form id="mail-form">
        ${field("title", "标题", "系统公告")}
        <div class="field">
          <label for="body">正文</label>
          <textarea class="textarea" id="body" name="body">奖励已发放，请查收附件。</textarea>
        </div>
        <div class="form-grid three">
          ${field("rewardCoins", "金币", 0, "number")}
          <div class="field">
            <label for="rewardItemId">物品</label>
            <select class="select" id="rewardItemId" name="rewardItemId">
              <option value="">无物品</option>
              ${items.map((item) => `<option value="${html(item.id)}">${html(item.id)} / ${html(item.name_zh || item.name_en || item.type)}</option>`).join("")}
            </select>
          </div>
          ${field("rewardQuantity", "数量", 1, "number")}
        </div>
        ${field("expiresAt", "过期时间", "", "datetime-local")}
        <div class="notice">将发送给所有非管理员玩家，root 和 GM 账号不会收到。</div>
        <div class="actions"><button class="btn btn-danger" type="submit">发送全服邮件</button></div>
      </form>
    </section>
  `;
}

function renderMailHistoryTable(data, compact = false) {
  const mails = rowsOf(data);
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>标题</th><th>内容</th><th>奖励</th><th>收件</th><th>状态</th><th>时间</th></tr>
        </thead>
        <tbody>
          ${mails.map((mail) => `
            <tr>
              <td>
                <strong>${html(mail.title)}</strong><br />
                <span class="muted">${html(mail.sender_nickname || mail.sender_account || "system")}</span><br />
                <span class="muted mono">${html(mail.batch_id || "-")}</span>
              </td>
              <td>${html(mail.body || "").slice(0, compact ? 40 : 120)}</td>
              <td>${mailReward(mail)}</td>
              <td>${number(mail.recipients || 1)} 人<br /><span class="muted">已读 ${number((mail.recipients || 1) - (mail.unread_count || 0))}</span></td>
              <td>${mailStatusSummary(mail)}</td>
              <td>${shortDate(mail.created_at)}${mail.expires_at ? `<br /><span class="muted">过期 ${shortDate(mail.expires_at)}</span>` : ""}</td>
            </tr>
          `).join("") || `<tr><td colspan="6" class="muted">暂无邮件记录</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function mailReward(mail) {
  const parts = [];
  if (Number(mail.reward_coins || 0) > 0) parts.push(`${number(mail.reward_coins)} coins`);
  if (mail.reward_item_id) parts.push(`${html(mail.reward_item_id)} x${number(mail.reward_quantity || 1)}`);
  return parts.join("<br />") || `<span class="muted">无附件</span>`;
}

function mailStatusSummary(mail) {
  const parts = [];
  if (Number(mail.unread_count || 0) > 0) parts.push(`未读 ${number(mail.unread_count)}`);
  if (Number(mail.unclaimed_count || 0) > 0) parts.push(`未领 ${number(mail.unclaimed_count)}`);
  if (Number(mail.expired_count || 0) > 0) parts.push(`过期 ${number(mail.expired_count)}`);
  if (!parts.length && Number(mail.claimed_count || 0) > 0) parts.push(`已领 ${number(mail.claimed_count)}`);
  return parts.length ? parts.map((part) => `<span class="pill">${html(part)}</span>`).join("<br />") : `<span class="muted">无待处理</span>`;
}

function auditQueryString() {
  const params = new URLSearchParams({
    page: String(state.auditPage),
    pageSize: String(PAGE_SIZE),
  });
  const filters = state.auditFilters || {};
  if (filters.type) params.set("type", filters.type);
  if (filters.actorUserId) params.set("actorUserId", filters.actorUserId);
  if (filters.targetUserId) params.set("targetUserId", filters.targetUserId);
  return params.toString();
}

async function loadAudit() {
  const logs = await request(`/admin/audit-logs?${auditQueryString()}`);
  const rows = rowsOf(logs);
  setContent(`
    <div class="toolbar">
      <span class="pill">${number(totalOf(logs))} 条流水</span>
      <span class="subtle">记录 GM 操作、奖励发放、兑换、邮件领取等关键数据变化。</span>
    </div>
    ${renderAuditFilters()}
    ${renderAuditTable(rows)}
    ${renderPagination(logs, "audit")}
  `);
}

function renderAuditFilters() {
  const filters = state.auditFilters || {};
  const types = [
    "gm_update_user",
    "gm_send_mail",
    "gm_broadcast_mail",
    "gm_grant_item",
    "gm_create_redeem_code",
    "gm_toggle_redeem_code",
    "gm_settle_daily_leaderboard",
    "mail_claim",
    "redeem_code",
    "shop_buy",
    "equip_item",
    "lootbox_open",
    "gacha_open",
    "game_result",
  ];
  return `
    <form class="panel compact-panel" id="audit-filter-form">
      <div class="form-grid three">
        <div class="field">
          <label for="auditType">类型</label>
          <select class="select" id="auditType" name="type">
            <option value="">全部类型</option>
            ${types.map((type) => `<option value="${html(type)}" ${filters.type === type ? "selected" : ""}>${html(eventLabel(type))}</option>`).join("")}
          </select>
        </div>
        ${field("actorUserId", "操作者 ID", filters.actorUserId || "", "number")}
        ${field("targetUserId", "目标玩家 ID", filters.targetUserId || "", "number")}
      </div>
      <div class="actions">
        <button class="btn btn-good" type="submit">筛选</button>
        <button class="btn" data-action="reset-audit-filters" type="button">重置</button>
      </div>
    </form>
  `;
}

function eventLabel(type) {
  const labels = {
    gm_update_user: "GM 修改玩家",
    gm_send_mail: "GM 单人邮件",
    gm_broadcast_mail: "GM 全服邮件",
    gm_grant_item: "GM 发物品",
    gm_create_redeem_code: "GM 创建兑换码",
    gm_toggle_redeem_code: "GM 切换兑换码",
    gm_settle_daily_leaderboard: "GM 日榜结算",
    mail_claim: "领取邮件",
    redeem_code: "兑换码",
    shop_buy: "购买物品",
    equip_item: "装备物品",
    lootbox_open: "开箱",
    gacha_open: "十连开箱",
    game_result: "对局结算",
  };
  return labels[type] || type || "-";
}

function userLabel(row, prefix) {
  const id = row[`${prefix}_user_id`];
  const name = row[`${prefix}_username`] || row[`${prefix}_account`];
  if (!id && !name) return "-";
  return `${name ? html(name) : "用户"}${id ? `<br /><span class="muted mono">#${html(id)}</span>` : ""}`;
}

function eventReward(row) {
  const parts = [];
  const coins = Number(row.delta_coins || 0);
  if (coins) parts.push(`${coins > 0 ? "+" : ""}${number(coins)} coins`);
  if (row.item_id) parts.push(`${html(row.item_id)} x${number(row.quantity || 1)}`);
  return parts.join("<br />") || `<span class="muted">-</span>`;
}

function metadataSummary(row) {
  const metadata = readJson(row.metadata_json, null);
  if (!metadata || typeof metadata !== "object") return `<span class="muted">-</span>`;
  if (metadata.patch && typeof metadata.patch === "object") {
    const keys = Object.keys(metadata.patch);
    return keys.length ? `修改：${html(keys.join(", "))}` : `<span class="muted">-</span>`;
  }
  const highlights = [];
  if (metadata.title) highlights.push(`标题：${metadata.title}`);
  if (metadata.mailId) highlights.push(`邮件 ID：${metadata.mailId}`);
  if (metadata.batchId) highlights.push(`邮件批次：${metadata.batchId}`);
  if (metadata.rewardBatchId) highlights.push(`奖励批次：${metadata.rewardBatchId}`);
  if (metadata.settlementId) highlights.push(`结算 ID：${metadata.settlementId}`);
  if (metadata.settlementDate || metadata.date) highlights.push(`日期：${metadata.settlementDate || metadata.date}`);
  if (metadata.rewardsSent !== undefined) highlights.push(`发奖：${number(metadata.rewardsSent)} 封`);
  if (metadata.sent !== undefined) highlights.push(`发送：${number(metadata.sent)} 人`);
  if (metadata.playerCount !== undefined) highlights.push(`玩家：${number(metadata.playerCount)} 人`);
  if (metadata.topUserId) highlights.push(`榜首：#${metadata.topUserId}`);
  if (metadata.code) highlights.push(`兑换码：${metadata.code}`);
  if (metadata.rank) highlights.push(`名次：${number(metadata.rank)}`);
  if (metadata.dailyPoints !== undefined) highlights.push(`日积分：${number(metadata.dailyPoints)}`);
  if (metadata.alreadySettled !== undefined) highlights.push(metadata.alreadySettled ? "已结算" : "新结算");
  if (metadata.expiresAt) highlights.push(`过期：${shortDate(metadata.expiresAt)}`);
  if (highlights.length) {
    return highlights.slice(0, 6).map((part) => html(part)).join("<br />");
  }
  const text = Object.entries(metadata)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 4)
    .map(([key, value]) => {
      const display = typeof value === "object" ? JSON.stringify(value) : String(value);
      return `${key}: ${display.slice(0, 80)}`;
    })
    .join(" / ");
  return text ? html(text) : `<span class="muted">-</span>`;
}

function renderAuditTable(rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>时间</th><th>类型</th><th>目标</th><th>操作人</th><th>变动</th><th>摘要</th></tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${shortDate(row.created_at)}</td>
              <td>${html(eventLabel(row.type))}<br /><span class="muted mono">${html(row.type)}</span></td>
              <td>${userLabel(row, "target")}</td>
              <td>${userLabel(row, "actor")}</td>
              <td>${eventReward(row)}</td>
              <td>${metadataSummary(row)}</td>
            </tr>
          `).join("") || `<tr><td colspan="6" class="muted">暂无审计流水</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

async function loadOnline() {
  const users = await request("/admin/online-users");
  setContent(`
    <div class="toolbar"><span class="pill">${users.length} 个在线会话</span></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>玩家</th><th>状态</th><th>房间</th><th>最近活跃</th></tr></thead>
        <tbody>
          ${users.map((user) => `
            <tr>
              <td class="mono">${html(user.userId)}</td>
              <td>${html(user.nickname || user.username || "-")}<br /><span class="muted">${html(user.account || "")}</span></td>
              <td><span class="pill">${html(user.onlineStatus || "online")}</span></td>
              <td class="mono">${html(user.roomId || "-")}</td>
              <td>${user.lastActiveAt ? shortDate(user.lastActiveAt) : "-"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `);
}

async function loadItems() {
  const items = await ensureShopItems();
  setContent(`
    <div class="toolbar">
      <span class="pill">${items.length} 个物品</span>
      <span class="subtle">首版只读。后续会补新增、上下架、价格编辑。</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>类型</th><th>名称</th><th>描述</th><th>价格</th><th>库存</th></tr></thead>
        <tbody>
          ${items.map((item) => `
            <tr>
              <td class="mono">${html(item.id)}</td>
              <td>${html(item.type)}</td>
              <td>${html(item.icon || "")} ${html(item.name_zh || item.name_en || "-")}</td>
              <td>${html(item.desc_zh || item.desc_en || "")}</td>
              <td>${number(item.price)}</td>
              <td>${Number(item.stock || 0) < 0 ? "∞" : number(item.stock)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `);
}

async function loadSettlement() {
  const settlements = await request("/admin/leaderboard/settlements?limit=30");
  const today = new Date().toISOString().slice(0, 10);
  setContent(`
    <div class="split">
      <section class="panel">
        <h2>手动日榜结算</h2>
        <p class="subtle">结算指定日期的今日积分榜，发放奖励邮件并清零对应日期的榜单积分。</p>
        <form id="settlement-form">
          <div class="field">
            <label for="settlement-date">结算日期</label>
            <input class="input" id="settlement-date" name="date" type="date" value="${today}" />
          </div>
          <div class="notice">
            第 1 名：1000 金币 + 今日榜一称号；第 2 名：600 金币；第 3 名：300 金币。
          </div>
          <div class="actions">
            <button class="btn btn-danger" type="submit">结算并发奖</button>
          </div>
        </form>
      </section>
      <section>
        ${renderSettlementTable(settlements)}
      </section>
    </div>
  `);
}

function renderSettlementTable(rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>日期</th><th>榜首</th><th>玩家数</th><th>奖励</th><th>创建时间</th></tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td class="mono">${html(String(row.settlement_date || "").slice(0, 10))}</td>
              <td>${html(row.top_nickname || row.top_account || "-")}<br /><span class="muted">${number(row.top_points || 0)} pts</span></td>
              <td>${number(row.player_count)}</td>
              <td>${number(row.rewards_sent)} 封</td>
              <td>${shortDate(row.created_at)}</td>
            </tr>
          `).join("") || `<tr><td colspan="5" class="muted">暂无结算记录</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();

  try {
    if (form.id === "login-form") {
      const data = formObject(form);
      state.apiBase = normalizeApiBase(data.apiBase);
      const result = await request("/auth/login", {
        method: "POST",
        body: { account: data.account, username: data.account, password: data.password },
      });
      state.token = result.token;
      state.user = result.user;
      try {
        await request("/admin/summary");
      } catch (error) {
        clearSession();
        throw error;
      }
      saveSession();
      state.error = "";
      render();
      return;
    }

    if (form.id === "user-search-form") {
      await loadUsers(String(formObject(form).query || ""));
      return;
    }

    if (form.id === "audit-filter-form") {
      const data = formObject(form);
      state.auditFilters = {
        type: String(data.type || ""),
        actorUserId: String(data.actorUserId || "").trim(),
        targetUserId: String(data.targetUserId || "").trim(),
      };
      state.auditPage = 1;
      await loadAudit();
      return;
    }

    if (form.id === "user-update-form") {
      const data = formObject(form);
      const id = form.dataset.userId;
      await request(`/admin/users/${id}`, {
        method: "PUT",
        body: {
          account: data.account,
          nickname: data.nickname,
          coins: intValue(data.coins),
          points: intValue(data.points),
          daily_points: intValue(data.daily_points),
          level: intValue(data.level, 1),
          is_admin: data.is_admin === "true",
        },
      });
      setMessage("玩家资料已保存");
      await loadUserDetail(id);
      return;
    }

    if (form.id === "grant-item-form") {
      const data = formObject(form);
      const id = form.dataset.userId;
      await request(`/admin/users/${id}/grant-item`, {
        method: "POST",
        body: {
          itemId: data.itemId,
          quantity: intValue(data.quantity, 1),
        },
      });
      setMessage("物品已发放");
      await loadUserDetail(id);
      return;
    }

    if (form.id === "grant-custom-title-form") {
      const data = formObject(form);
      const id = form.dataset.userId;
      await request(`/admin/users/${id}/grant-custom-title`, {
        method: "POST",
        body: {
          titleKey: data.customTitleKey,
          nameZh: data.customTitleZh,
          nameEn: data.customTitleEn,
          descZh: data.customTitleDescZh,
          descEn: data.customTitleDescEn,
          icon: data.customTitleIcon,
          equipNow: data.equipNow === "on",
        },
      });
      state.shopItems = [];
      setMessage("专属称号已发放");
      await loadUserDetail(id);
      return;
    }

    if (form.id === "user-mail-form") {
      const data = formObject(form);
      const id = form.dataset.userId;
      const result = await request("/admin/mail", {
        method: "POST",
        body: {
          targetUserId: Number(id),
          title: data.title,
          body: data.body,
          rewardCoins: intValue(data.rewardCoins),
          rewardItemId: data.rewardItemId || null,
          rewardQuantity: intValue(data.rewardQuantity, 1),
          expiresAt: data.expiresAt || null,
        },
      });
      setMessage(`单人邮件已发送，收件 ${number(result.sent)} 人`);
      await loadUserDetail(id);
      return;
    }

    if (form.id === "redeem-form") {
      const data = formObject(form);
      await request("/admin/redeem-codes", {
        method: "POST",
        body: {
          code: data.code,
          rewardCoins: intValue(data.rewardCoins),
          rewardItemId: data.rewardItemId || null,
          rewardQuantity: intValue(data.rewardQuantity, 1),
          maxUses: intValue(data.maxUses, 1),
          expiresAt: data.expiresAt || null,
          isActive: data.isActive === "on",
        },
      });
      setMessage("兑换码已创建");
      await loadRedeems();
      return;
    }

    if (form.id === "mail-form") {
      const data = formObject(form);
      const result = await request("/admin/mail", {
        method: "POST",
        body: {
          allUsers: true,
          title: data.title,
          body: data.body,
          rewardCoins: intValue(data.rewardCoins),
          rewardItemId: data.rewardItemId || null,
          rewardQuantity: intValue(data.rewardQuantity, 1),
          expiresAt: data.expiresAt || null,
        },
      });
      setMessage(`全服邮件已发送，收件人 ${number(result.sent)} 人`);
      state.mailTab = "history";
      state.mailStatus = "all";
      state.mailHistoryPage = 1;
      await loadMail();
      return;
    }

    if (form.id === "settlement-form") {
      const data = formObject(form);
      const result = await request("/admin/leaderboard/settle", {
        method: "POST",
        body: { date: data.date || undefined },
      });
      setMessage(result.alreadySettled
        ? `日榜 ${data.date || ""} 已结算，未重复发奖`
        : `日榜 ${data.date || ""} 结算完成，发奖 ${number(result.entries?.length || 0)} 封`);
      await loadSettlement();
      return;
    }
  } catch (error) {
    setMessage("", error.message);
  }
});

document.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const nav = target.closest("button[data-nav]");
  if (nav) {
    state.view = nav.dataset.nav;
    state.message = "";
    state.error = "";
    renderShell();
    await loadView(state.view);
    return;
  }

  const action = target.closest("button[data-action]");
  if (action?.dataset.action === "logout") {
    clearSession();
    state.message = "";
    state.error = "";
    renderLogin();
    return;
  }
  if (action?.dataset.action === "refresh") {
    await loadView(state.view);
    return;
  }
  if (action?.dataset.action === "reset-audit-filters") {
    state.auditFilters = { type: "", actorUserId: "", targetUserId: "" };
    state.auditPage = 1;
    await loadAudit();
    return;
  }

  const pageButton = target.closest("button[data-page-key]");
  if (pageButton) {
    const key = pageButton.dataset.pageKey || "";
    const page = Math.max(1, intValue(pageButton.dataset.page, 1));
    try {
      if (key === "audit") {
        state.auditPage = page;
        await loadAudit();
      }
      if (key === "mail-history") {
        state.mailHistoryPage = page;
        await loadMail();
      }
      if (key === "user-events") {
        await loadUserEventsPage(page);
      }
      if (key === "redeem-uses" && state.selectedRedeemCodeId) {
        await loadRedeemUses(state.selectedRedeemCodeId, page);
      }
    } catch (error) {
      setMessage("", error.message);
    }
    return;
  }

  const userButton = target.closest("button[data-user-id]");
  if (userButton) {
    try {
      state.userDetailTab = "overview";
      await loadUserDetail(userButton.dataset.userId);
    } catch (error) {
      setMessage("", error.message);
    }
    return;
  }

  const detailTab = target.closest("button[data-user-detail-tab]");
  if (detailTab) {
    state.userDetailTab = detailTab.dataset.userDetailTab || "overview";
    const detailTarget = document.querySelector("#user-detail");
    if (state.selectedUser && state.selectedUserDetail && detailTarget) {
      detailTarget.innerHTML = renderUserDetail(state.selectedUser, state.selectedUserDetail);
    }
    return;
  }

  const toggleCode = target.closest("button[data-toggle-code]");
  if (toggleCode) {
    try {
      await request(`/admin/redeem-codes/${toggleCode.dataset.toggleCode}/active`, {
        method: "POST",
        body: { isActive: toggleCode.dataset.active === "1" },
      });
      setMessage("兑换码状态已更新");
      await loadRedeems();
    } catch (error) {
      setMessage("", error.message);
    }
    return;
  }

  const redeemUses = target.closest("button[data-redeem-uses-id]");
  if (redeemUses) {
    try {
      await loadRedeemUses(redeemUses.dataset.redeemUsesId);
    } catch (error) {
      setMessage("", error.message);
    }
    return;
  }

  const mailTab = target.closest("button[data-mail-tab]");
  if (mailTab) {
    state.mailTab = mailTab.dataset.mailTab || "compose";
    state.mailHistoryPage = 1;
    await loadMail();
    return;
  }

  const mailStatus = target.closest("button[data-mail-status]");
  if (mailStatus) {
    state.mailStatus = mailStatus.dataset.mailStatus || "all";
    state.mailHistoryPage = 1;
    await loadMail();
  }
});

render();
