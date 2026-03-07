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
function roleLabel(role) { return ROLE_LABELS[role] || role; }

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
    DOM.loginError.textContent = 'Name and PIN required';
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
    showToast(`Welcome, ${resp.name}`, 'success');
  } catch (err) {
    DOM.loginError.textContent = 'Invalid name or PIN';
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
    hideLoginOverlay();
    authRole = 'admin'; // full access in open mode
    applyRole();
    return;
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

  // User panel: Admin only
  if (DOM.userPanel) {
    DOM.userPanel.style.display = (isAuth && level >= ROLE_LEVELS.admin) ? '' : 'none';
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
      DOM.timerLockBtn.textContent = 'Release';
      DOM.timerLockBtn.classList.add('active');
      DOM.timerLockBtn.onclick = releaseTimerLock;
    } else {
      DOM.timerLockBtn.textContent = 'Locked';
      DOM.timerLockBtn.classList.remove('active');
      DOM.timerLockBtn.disabled = true;
    }
    if (DOM.timerLockStatus) {
      DOM.timerLockStatus.textContent = isMe ? 'You have control' : `${status.holder.user_name} has control`;
    }
  } else {
    hasTimerLock = false;
    DOM.timerLockBtn.textContent = 'Take Control';
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
    showToast('Timer control acquired', 'success');
  } catch (e) {
    if (e.message.includes('409') || e.message.includes('Conflict')) {
      showToast('Timer is locked by another manager', 'error');
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
    showToast('Timer control released', 'success');
  } catch (e) {
    showToast(`Failed: ${e.message}`, 'error');
  }
}

// ── User management (Admin) ─────────────────

async function loadUsers() {
  if (roleLevel(authRole) < ROLE_LEVELS.admin) return;
  try {
    const users = await api('/users');
    renderUserList(users);
  } catch (e) { /* ignore */ }
}

function renderUserList(users) {
  if (!DOM.userList) return;
  if (!users || users.length === 0) {
    DOM.userList.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem;padding:0.5rem">No users configured.</div>';
    return;
  }
  DOM.userList.innerHTML = users.map(u => `
    <div class="user-item">
      <div class="user-info">
        <span class="user-name">${esc(u.name)}</span>
        <span class="user-role">${roleLabel(u.role)}</span>
      </div>
      <div class="user-actions">
        <button class="icon-btn" onclick="openUserModal('${u.id}')" title="Edit">&#9998;</button>
        <button class="icon-btn danger" onclick="deleteUser('${u.id}', '${esc(u.name)}')" title="Delete">&times;</button>
      </div>
    </div>
  `).join('');
}

function openUserModal(editId) {
  const modal = document.getElementById('user-modal');
  document.getElementById('user-edit-id').value = editId || '';

  if (editId) {
    document.getElementById('user-modal-title').textContent = 'Edit User';
    // Fetch user data
    api(`/users`).then(users => {
      const u = users.find(x => x.id === editId);
      if (u) {
        document.getElementById('user-name-input').value = u.name;
        document.getElementById('user-pin-input').value = '';
        document.getElementById('user-pin-input').placeholder = 'Leave empty to keep current';
        document.getElementById('user-role-select').value = u.role;
        populateUserDepts(u.departments || []);
      }
    });
  } else {
    document.getElementById('user-modal-title').textContent = 'Add User';
    document.getElementById('user-name-input').value = '';
    document.getElementById('user-pin-input').value = '';
    document.getElementById('user-pin-input').placeholder = 'PIN';
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

  if (!body.name) { showToast('Name is required', 'error'); return; }
  if (!id && !body.pin) { showToast('PIN is required for new users', 'error'); return; }

  if (await apiSave('/users', id, body, 'User')) {
    closeModal('user-modal');
    loadUsers();
  }
}

async function deleteUser(id, name) {
  if (await apiDelete(`/users/${id}`, 'Delete User', `Delete user "${name}"?`, 'User')) {
    loadUsers();
  }
}
