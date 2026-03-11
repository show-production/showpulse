/* ══════════════════════════════════════════
   auth.js — Authentication, role gating, timer lock, user management
   ══════════════════════════════════════════
   Sections:
     Role hierarchy  — ROLE_LEVELS, ROLE_LABELS, roleLevel, roleLabel
     Auth state      — saveAuth, clearAuth
     Login overlay   — showLoginOverlay, hideLoginOverlay, handleLogin, handleLogout
     Auth init       — initAuth (token validation, open-access fallback)
     Role gating     — applyRole (tab/transport/lock visibility per role)
     Timer lock      — refreshTimerLock, updateTimerLockUI, acquire, release
     User management — loadUsers, renderUserList, openUserModal, saveUser, deleteUser
   Dependencies: state.js, api.js (apiSave, apiDelete, showToast, closeModal)
   ══════════════════════════════════════════ */

// ── Role hierarchy ──────────────────────────

const ROLE_LEVELS = { viewer: 1, crew_lead: 2, operator: 3, manager: 4, admin: 5 };
const ROLE_LABELS = { viewer: 'Viewer', crew_lead: 'Crew Lead', operator: 'Operator', manager: 'Manager', admin: 'Admin' };

function roleLevel(role) { return ROLE_LEVELS[role] || 0; }
function roleLabel(role) { return t('role.' + role) || ROLE_LABELS[role] || role; }

// ── Auth state helpers ──────────────────────

function saveAuth(token, role, name, depts) {
  authToken = token;
  authRole = role;
  authName = name;
  authDepts = depts || [];
  localStorage.setItem('authToken', token);
  localStorage.setItem('authRole', role);
  localStorage.setItem('authName', name);
  localStorage.setItem('authDepts', JSON.stringify(authDepts));
}

function clearAuth() {
  authToken = null;
  authRole = null;
  authName = null;
  authDepts = [];
  hasTimerLock = false;
  localStorage.removeItem('authToken');
  localStorage.removeItem('authRole');
  localStorage.removeItem('authName');
  localStorage.removeItem('authDepts');
}

// ── Login overlay ───────────────────────────

function showLoginOverlay() {
  if (DOM.loginOverlay) {
    DOM.loginOverlay.classList.add('visible');
    DOM.loginError.textContent = '';
    DOM.loginPin.value = '';
    DOM.loginName.focus();
  }
}

function hideLoginOverlay() {
  if (DOM.loginOverlay) DOM.loginOverlay.classList.remove('visible');
}

async function handleLogin(e) {
  if (e) e.preventDefault();
  const name = DOM.loginName.value.trim();
  const pin = DOM.loginPin.value.trim();
  if (!name || !pin) {
    DOM.loginError.textContent = t('login.error.required');
    return;
  }
  DOM.loginBtn.disabled = true;
  DOM.loginError.textContent = '';
  try {
    const resp = await api('/auth/login', { method: 'POST', body: { name, pin } });
    saveAuth(resp.token, resp.role, resp.name, resp.departments);
    hideLoginOverlay();
    applyRole();
    // Reload data now that we're authenticated
    try {
      await loadDepartments();
      await loadCues();
      renderDeptFilters();
    } catch (e2) { /* ignore — data may not be available for this role */ }
    refreshTimerLock();
    // Reconnect WebSocket with auth token so dashboard shows this user
    if (ws) { ws.onclose = null; ws.close(); }
    connectWS();
    showToast(t('login.success', { name: resp.name }), 'success');
  } catch (err) {
    DOM.loginError.textContent = t('login.error.invalid');
  } finally {
    DOM.loginBtn.disabled = false;
  }
}

async function handleLogout() {
  try {
    await api('/auth/logout', { method: 'POST' });
  } catch (e) { /* ignore */ }
  clearAuth();
  showLoginOverlay();
  applyRole();
}

// ── Auth initialization ─────────────────────

async function initAuth() {
  try {
    const status = await api('/auth/status');
    authEnabled = status.auth_enabled;
  } catch (e) {
    authEnabled = false;
  }

  if (!authEnabled) {
    // Open access — hide login, show everything
    clearAuth();
    hideLoginOverlay();
    authRole = 'admin'; // full access in open mode
    applyRole();
    return;
  }

  // Auto-login from URL params: ?user=Name&pin=1234
  const urlParams = new URLSearchParams(location.search);
  const autoUser = urlParams.get('user');
  const autoPin = urlParams.get('pin');
  if (autoUser && autoPin) {
    try {
      const resp = await api('/auth/login', { method: 'POST', body: { name: autoUser, pin: autoPin } });
      saveAuth(resp.token, resp.role, resp.name, resp.departments);
      // Clean URL
      history.replaceState(null, '', location.pathname);
      hideLoginOverlay();
      applyRole();
      // Don't connectWS() here — init() calls it after initAuth() returns
      return;
    } catch (e) {
      // Auto-login failed, fall through to normal flow
    }
  }

  // Auth enabled — check saved token
  if (authToken) {
    try {
      // Validate token by fetching timecode (lightweight GET)
      await api('/timecode');
      applyRole();
      return;
    } catch (e) {
      // Token invalid
      clearAuth();
    }
  }

  showLoginOverlay();
  applyRole();
}

// ── Role-based UI gating ────────────────────

function applyRole() {
  const level = roleLevel(authRole);
  const isAuth = !!authToken || !authEnabled;

  // Nav tabs: Show always visible, Manage for Operator+, Settings for Manager+
  DOM.navTabs.forEach(tab => {
    const view = tab.dataset.view;
    if (view === 'show') {
      tab.style.display = '';
    } else if (view === 'manage') {
      tab.style.display = (isAuth && level >= ROLE_LEVELS.operator) ? '' : 'none';
    } else if (view === 'settings') {
      tab.style.display = (isAuth && level >= ROLE_LEVELS.manager) ? '' : 'none';
    }
  });

  // Transport controls: Manager+ only
  if (DOM.tcTransport) DOM.tcTransport.style.display = (isAuth && level >= ROLE_LEVELS.manager) ? '' : 'none';
  if (DOM.tcGotoGroup) DOM.tcGotoGroup.style.display = (isAuth && level >= ROLE_LEVELS.manager) ? '' : 'none';

  // Timer lock: visible for Manager (Admin bypasses)
  if (DOM.timerLockBtn) {
    DOM.timerLockBtn.style.display = (isAuth && authRole === 'manager') ? '' : 'none';
  }
  if (DOM.timerLockStatus) {
    DOM.timerLockStatus.style.display = (isAuth && level >= ROLE_LEVELS.manager) ? '' : 'none';
  }

  // Admin dashboard panel (users + active connections)
  if (DOM.dashboardPanel) {
    DOM.dashboardPanel.style.display = (isAuth && level >= ROLE_LEVELS.admin) ? '' : 'none';
  }

  // Logout button + user label
  if (DOM.logoutBtn) {
    DOM.logoutBtn.style.display = (authEnabled && authToken) ? '' : 'none';
  }
  if (DOM.authUserLabel) {
    DOM.authUserLabel.textContent = (authEnabled && authName) ? `${authName} (${roleLabel(authRole)})` : '';
    DOM.authUserLabel.style.display = (authEnabled && authName) ? '' : 'none';
  }

  // Viewer/CrewLead: pre-filter departments
  if (isAuth && level <= ROLE_LEVELS.crew_lead && authDepts.length > 0) {
    activeDeptFilters = new Set(authDepts);
    renderDeptFilters();
  }
}

// ── Timer lock ──────────────────────────────

async function refreshTimerLock() {
  if (!authEnabled || roleLevel(authRole) < ROLE_LEVELS.manager) return;
  try {
    const status = await api('/timer-lock');
    updateTimerLockUI(status);
  } catch (e) { /* ignore */ }
}

function updateTimerLockUI(status) {
  if (!DOM.timerLockBtn) return;

  if (status.locked && status.holder) {
    const isMe = status.holder.user_name === authName;
    hasTimerLock = isMe;
    if (isMe) {
      DOM.timerLockBtn.textContent = t('timer.release');
      DOM.timerLockBtn.classList.add('active');
      DOM.timerLockBtn.onclick = releaseTimerLock;
    } else {
      DOM.timerLockBtn.textContent = t('timer.locked');
      DOM.timerLockBtn.classList.remove('active');
      DOM.timerLockBtn.disabled = true;
    }
    if (DOM.timerLockStatus) {
      DOM.timerLockStatus.textContent = isMe ? t('timer.youHaveControl') : t('timer.hasControl', { name: status.holder.user_name });
    }
  } else {
    hasTimerLock = false;
    DOM.timerLockBtn.textContent = t('timer.takeControl');
    DOM.timerLockBtn.classList.remove('active');
    DOM.timerLockBtn.disabled = false;
    DOM.timerLockBtn.onclick = acquireTimerLock;
    if (DOM.timerLockStatus) {
      DOM.timerLockStatus.textContent = '';
    }
  }
}

async function acquireTimerLock() {
  try {
    const status = await api('/timer-lock', { method: 'POST' });
    updateTimerLockUI(status);
    showToast(t('timer.acquired'), 'success');
  } catch (e) {
    if (e.message.includes('409') || e.message.includes('Conflict')) {
      showToast(t('timer.conflict'), 'error');
    } else {
      showToast(`Failed: ${e.message}`, 'error');
    }
    refreshTimerLock();
  }
}

async function releaseTimerLock() {
  try {
    await api('/timer-lock', { method: 'DELETE' });
    hasTimerLock = false;
    refreshTimerLock();
    showToast(t('timer.released'), 'success');
  } catch (e) {
    showToast(`Failed: ${e.message}`, 'error');
  }
}

// ── User management (Admin) ─────────────────

let _cachedUsers = [];

async function loadUsers() {
  if (roleLevel(authRole) < ROLE_LEVELS.admin) return;
  try {
    _cachedUsers = await api('/users');
  } catch (e) { /* ignore */ }
}

function openUserModal(editId) {
  const modal = document.getElementById('user-modal');
  document.getElementById('user-edit-id').value = editId || '';

  if (editId) {
    document.getElementById('user-modal-title').textContent = t('userModal.edit');
    // Fetch user data
    api(`/users`).then(users => {
      const u = users.find(x => x.id === editId);
      if (u) {
        document.getElementById('user-name-input').value = u.name;
        document.getElementById('user-pin-input').value = '';
        document.getElementById('user-pin-input').placeholder = t('userModal.pinKeep');
        document.getElementById('user-role-select').value = u.role;
        populateUserDepts(u.departments || []);
      }
    });
  } else {
    document.getElementById('user-modal-title').textContent = t('userModal.add');
    document.getElementById('user-name-input').value = '';
    document.getElementById('user-pin-input').value = '';
    document.getElementById('user-pin-input').placeholder = t('userModal.pinPlaceholder');
    document.getElementById('user-role-select').value = 'operator';
    populateUserDepts([]);
  }
  modal.classList.add('open');
  document.getElementById('user-name-input').focus();
}

function populateUserDepts(selectedIds) {
  const container = document.getElementById('user-dept-checks');
  container.innerHTML = departments.map(d => `
    <label class="dept-check">
      <input type="checkbox" value="${d.id}" ${selectedIds.includes(d.id) ? 'checked' : ''}>
      <span class="chip-dot" style="background:${d.color}"></span>
      ${esc(d.name)}
    </label>
  `).join('');
}

async function saveUser() {
  const id = document.getElementById('user-edit-id').value;
  const deptChecks = document.querySelectorAll('#user-dept-checks input:checked');
  const depts = Array.from(deptChecks).map(cb => cb.value);

  const body = {
    id: id || CONST.NULL_UUID,
    name: document.getElementById('user-name-input').value.trim(),
    pin: document.getElementById('user-pin-input').value.trim(),
    role: document.getElementById('user-role-select').value,
    departments: depts,
  };

  if (!body.name) { showToast(t('userModal.nameRequired'), 'error'); return; }
  if (!id && !body.pin) { showToast(t('userModal.pinRequired'), 'error'); return; }

  if (await apiSave('/users', id, body, t('entity.user'))) {
    closeModal('user-modal');
    loadDashboard();
  }
}

async function deleteUser(id, name) {
  if (await apiDelete(`/users/${id}`, t('userModal.deleteTitle'), t('userModal.confirmDelete', { name }), t('entity.user'))) {
    loadDashboard();
  }
}

// ── Admin dashboard (unified) ──────────────

let dashboardInterval = null;

function startDashboardPolling() {
  stopDashboardPolling();
  if (roleLevel(authRole) >= ROLE_LEVELS.admin) {
    loadDashboard();
    dashboardInterval = setInterval(loadDashboard, 10000);
  }
}

function stopDashboardPolling() {
  if (dashboardInterval) {
    clearInterval(dashboardInterval);
    dashboardInterval = null;
  }
}

async function loadDashboard() {
  if (roleLevel(authRole) < ROLE_LEVELS.admin) return;
  try {
    const [data, users] = await Promise.all([
      api('/admin/dashboard'),
      api('/users'),
    ]);
    _cachedUsers = users;
    renderDashboard(data, users);
  } catch (e) { /* ignore */ }
}

function fmtDuration(totalSec) {
  if (totalSec < 60) return `${totalSec}s`;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function renderDashboard(data, users) {
  if (!DOM.dashboardBody) return;

  // Build a map of online users: name -> { role, duration }
  const onlineMap = new Map();
  let anonCount = 0;
  for (const c of data.clients) {
    if (c.is_authenticated && c.user_name) {
      const prev = onlineMap.get(c.user_name);
      // Keep the longest session if same user has multiple connections
      if (!prev || c.connected_seconds > prev.connected_seconds) {
        onlineMap.set(c.user_name, c);
      }
    } else {
      anonCount++;
    }
  }

  const lockHolder = data.timer_lock.locked && data.timer_lock.holder
    ? data.timer_lock.holder.user_name : null;

  // Stat cards
  const stats = `
    <div class="dash-stats">
      <div class="dash-stat">
        <span class="dash-stat-value">${data.total_connections}</span>
        <span class="dash-stat-label">${t('dash.connected')}</span>
      </div>
      <div class="dash-stat">
        <span class="dash-stat-value">${onlineMap.size}</span>
        <span class="dash-stat-label">${t('dash.usersOnline')}</span>
      </div>
      <div class="dash-stat">
        <span class="dash-stat-value">${users.length}</span>
        <span class="dash-stat-label">${t('dash.registered')}</span>
      </div>
      <div class="dash-stat">
        <span class="dash-stat-value dash-stat-lock">${lockHolder ? esc(lockHolder) : '\u2014'}</span>
        <span class="dash-stat-label">${t('dash.timerControl')}</span>
      </div>
    </div>`;

  // User rows — registered users with online status
  const userRows = users.map(u => {
    const online = onlineMap.get(u.name);
    const statusDot = online
      ? `<span class="dash-dot dash-dot--on" title="${t('dash.onlineFor', { duration: fmtDuration(online.connected_seconds) })}"></span>`
      : `<span class="dash-dot dash-dot--off" title="${t('dash.offline')}"></span>`;
    const duration = online ? fmtDuration(online.connected_seconds) : '';
    const isLockHolder = lockHolder === u.name;
    const lockBadge = isLockHolder ? `<span class="dash-badge">${t('dash.control')}</span>` : '';
    return `<tr class="${online ? 'dash-row--online' : ''}">
      <td>${statusDot} ${esc(u.name)}</td>
      <td>${roleLabel(u.role)}${lockBadge}</td>
      <td class="dash-dur">${duration}</td>
      <td class="dash-actions">
        <button class="icon-btn" onclick="openUserModal('${u.id}')" title="Edit">&#9998;</button>
        <button class="icon-btn danger" onclick="deleteUser('${u.id}', '${esc(u.name).replace(/'/g, "&#39;")}')" title="Delete">&times;</button>
      </td>
    </tr>`;
  }).join('');

  // Anonymous connections row
  const anonRow = anonCount > 0
    ? `<tr><td><span class="dash-dot dash-dot--anon"></span> <span class="text-dim">${t('dash.anonymous')}</span></td><td class="text-dim" colspan="3">${anonCount} ${anonCount > 1 ? t('dash.connections') : t('dash.connection')}</td></tr>`
    : '';

  DOM.dashboardBody.innerHTML = `
    ${stats}
    <div class="dash-table-wrap">
    <table class="dash-table">
      <thead><tr><th>${t('dash.user')}</th><th>${t('dash.role')}</th><th>${t('dash.online')}</th><th></th></tr></thead>
      <tbody>${userRows}${anonRow}</tbody>
    </table>
    </div>
    ${users.length === 0 ? `<div class="text-dim" style="padding:0.75rem">${t('dash.noUsers')}</div>` : ''}
  `;
}

// ── Crew panel (Show tab sidebar) ────────

let crewPollInterval = null;

function startCrewPolling() {
  stopCrewPolling();
  loadCrewStatus();
  crewPollInterval = setInterval(loadCrewStatus, 15000);
}

function stopCrewPolling() {
  if (crewPollInterval) {
    clearInterval(crewPollInterval);
    crewPollInterval = null;
  }
}

async function loadCrewStatus() {
  try {
    const data = await api('/crew/status');
    renderCrewPanel(data);
  } catch (e) { /* ignore */ }
}

function renderCrewPanel(data) {
  if (!DOM.crewList) return;
  if (!data.departments || data.departments.length === 0) {
    DOM.crewList.innerHTML = `<div class="crew-empty">${t('crew.empty')}</div>`;
    return;
  }

  let html = '';
  for (const dept of data.departments) {
    html += `<div class="crew-dept-group">`;
    html += `<div class="crew-dept-name"><span class="chip-dot" style="background:${esc(dept.color)}"></span>${esc(dept.name)}</div>`;
    for (const m of dept.members) {
      const dotClass = m.online ? 'crew-dot--on' : 'crew-dot--off';
      html += `<div class="crew-member"><span class="crew-dot ${dotClass}"></span>${esc(m.name)}</div>`;
    }
    html += `</div>`;
  }
  DOM.crewList.innerHTML = html;
}
