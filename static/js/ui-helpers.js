/* ══════════════════════════════════════════
   ui-helpers.js — Toasts, modals, keyboard shortcuts, view switching, init
   ══════════════════════════════════════════
   Cross-cutting UI concerns and application initialization.
   Loaded last — calls initDOM() and wires up all event listeners.
   Dependencies: state.js, api.js, show.js, manage.js, settings.js, import-export.js
   Components: ToastContainer, ConfirmModal, TopNav (view switching)
   ══════════════════════════════════════════ */

// ── View switching ─────────────────────────

document.querySelectorAll('.tab[data-view]').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab[data-view]').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`view-${tab.dataset.view}`).classList.add('active');
    if (tab.dataset.view === 'manage') refreshManageView();
    if (tab.dataset.view === 'settings') { loadUsers(); refreshTimerLock(); loadShowName(); }
  });
});

// ── Toast notifications ────────────────────

/**
 * Show a toast notification.
 * @param {string} message - Toast message text.
 * @param {string} [type='info'] - Toast type: "success", "error", or "info".
 * @param {number} [duration] - Display duration in ms.
 */
function showToast(message, type = 'info', duration = CONST.TOAST_DURATION) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  DOM.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = `opacity ${CONST.TOAST_FADE_MS}ms`;
    setTimeout(() => toast.remove(), CONST.TOAST_FADE_MS);
  }, duration);
}

// ── Confirm modal ──────────────────────────

/**
 * Show a confirmation dialog and return a promise.
 * @param {string} title - Modal title.
 * @param {string} message - Confirmation message.
 * @returns {Promise<boolean>} Resolves true if confirmed, false if cancelled.
 */
function showConfirm(title, message) {
  return new Promise(resolve => {
    confirmResolve = resolve;
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-message').textContent = message;
    document.getElementById('confirm-modal').classList.add('open');
  });
}

/**
 * Close the confirm modal and resolve the promise.
 * @param {boolean} result - Whether the action was confirmed.
 */
function closeConfirm(result) {
  document.getElementById('confirm-modal').classList.remove('open');
  if (confirmResolve) {
    confirmResolve(result);
    confirmResolve = null;
  }
}

// ── Modal helpers ──────────────────────────

/**
 * Close a modal by ID.
 * @param {string} id - Modal overlay element ID.
 */
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

// Sync color picker with text input
document.getElementById('dept-color').addEventListener('input', (e) => {
  document.getElementById('dept-color-text').value = e.target.value;
});
document.getElementById('dept-color-text').addEventListener('input', (e) => {
  document.getElementById('dept-color').value = e.target.value;
});

// ── Keyboard shortcuts ─────────────────────

document.addEventListener('keydown', (e) => {
  // Don't trigger when typing in an input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

  const canControl = !authEnabled || roleLevel(authRole) >= ROLE_LEVELS.manager;
  if (e.code === 'Space') { e.preventDefault(); if (canControl) genCmd('play'); }
  else if (e.code === 'Escape') { if (canControl) genCmd('stop'); }
  else if (e.code === 'KeyP') { if (canControl) genCmd('pause'); }
  else if (e.code === 'KeyS') { e.preventDefault(); toggleSidebar(); }
  else if (e.code === 'KeyG') {
    e.preventDefault();
    if (canControl) DOM.gotoTc.focus();
  }
  else if (e.code === 'KeyN') { e.preventDefault(); if (canControl) nextCue(); }
  else if (e.code === 'KeyB') { e.preventDefault(); if (canControl) prevCue(); }
  else if (e.code === 'KeyA') { e.preventDefault(); toggleAutoPulse(); }
  else if (e.code === 'KeyC') { e.preventDefault(); jumpToCurrent(); }
});

// ── Initialization ─────────────────────────

loadTheme();

(async function init() {
  initDOM();
  // Auth check first
  await initAuth();
  try {
    await Promise.all([loadDepartments(), loadCues(), loadActs(), loadShowName()]);
    renderDeptFilters();
  } catch (e) {
    showToast('Failed to load initial data', 'error');
  }
  // Restore sidebar state
  if (sidebarOpen) toggleSidebar(true);
  // Restore autopulse state
  DOM.autoPulseBtn.classList.toggle('active', autoPulse);
  initAutoPulseScrollBlock();
  // Timer lock check for managers
  refreshTimerLock();
  // Hide loading overlay
  DOM.loadingOverlay.classList.add('hidden');
  setTimeout(() => DOM.loadingOverlay.remove(), 500);
})();

connectWS();

// Poll timecode status when WS is not delivering (fallback)
setInterval(async () => {
  if (wsConnected) return;
  try {
    const status = await api('/timecode');
    if (status) {
      DOM.tcValue.textContent = fmtTC(status.timecode);
      DOM.tcState.textContent = status.running ? 'RUNNING' : 'STOPPED';
      DOM.tcState.className = status.running ? 'running' : 'stopped';
      DOM.tcFps.textContent = `${status.frame_rate} fps`;
    }
  } catch (e) {
    // Silently ignore poll errors when disconnected
  }
}, CONST.POLL_INTERVAL);
