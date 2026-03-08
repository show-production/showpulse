/* ══════════════════════════════════════════
   state.js — Constants, global state, DOM cache, shared utilities
   ══════════════════════════════════════════
   Loaded first. No dependencies.
   Sections:
     CONST           — all magic values (thresholds, colors, timings, symbols)
     Global state    — departments, cues, acts, showName, filters, auth, WS
     DOM cache       — initDOM() populates DOM.* for frequently accessed elements
     Shared helpers  — formatCueLabel, parseTC, fmtTC, fmtCountdown,
                       tcToSeconds, tcObjToSeconds, hexToRgba, getDeptColor,
                       getCueWarnMax, esc
     CRUD helpers    — apiSave, apiDelete (generic save/delete with toast feedback)
   ══════════════════════════════════════════ */

// ── Constants ──────────────────────────────

/** All magic values extracted into a single namespace. */
const CONST = {
  // Timecode
  DEFAULT_TC: '00:00:00:00',
  DEFAULT_FPS: 30,
  NULL_UUID: '00000000-0000-0000-0000-000000000000',

  // Timings (ms)
  WS_RECONNECT_DELAY: 2000,
  GO_DISPLAY_DURATION: 2000,
  TOAST_DURATION: 3000,
  TOAST_FADE_MS: 300,
  POLL_INTERVAL: 1000,

  // Thresholds
  TIER_NEAR_SEC: 120,
  TIER_FAR_SEC: 600,
  DEFAULT_WARN_SEC: 10,

  // Colors (countdown traffic light)
  COLOR_COUNTDOWN_3: '#e05500',
  COLOR_COUNTDOWN_1: '#88cc00',
  TINT_ALPHA: 0.06,
  DEFAULT_DEPT_COLOR: '#888',
  DEFAULT_NEW_DEPT_COLOR: '#ffcc00',

  // Symbols
  BULLET: ' \u00b7 ',
  EMDASH: ' \u2014 ',
  CHECKMARK: '\u2713',

  // Text
  EMPTY_CUES_MSG: 'No cues yet. Go to Manage to add some.',
  NO_MATCH_MSG: 'No matching cues.',

  // Branding — nav logomark (favicon SVG at 20px)
  NAV_LOGO: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="20" height="20" style="vertical-align:-3px;margin-right:4px"><defs><filter id="ng" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b"/><feColorMatrix in="b" type="matrix" values="0 0 0 0 0 0 0 0 0 1 0 0 0 0 0.533 0 0 0 0.5 0" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><line x1="2" y1="32" x2="12" y2="32" stroke="#8888A0" stroke-width="3" stroke-linecap="round"/><line x1="52" y1="32" x2="62" y2="32" stroke="#8888A0" stroke-width="3" stroke-linecap="round"/><polyline points="12,32 20,52 32,10 44,52 52,32" fill="none" stroke="#00FF88" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" filter="url(#ng)"/></svg>',
};

// ── Global state ───────────────────────────

/** @type {Array<{id: string, name: string, color: string}>} */
let departments = [];

/** @type {Array<Object>} */
let cues = [];

/** @type {Array<{id: string, name: string, sort_order: number}>} */
let acts = [];

/** @type {string} */
let showName = '';

/** Active department filter IDs — empty means show all. */
let activeDeptFilters = new Set();

/** @type {WebSocket|null} */
let ws = null;

/** Whether the WebSocket is currently connected. */
let wsConnected = false;

/** Resolve function for the confirm modal promise. */
let confirmResolve = null;

/** Whether the sidebar is open (persisted to localStorage). */
let sidebarOpen = localStorage.getItem('sidebarOpen') === 'true';

/** Whether AutoPulse auto-scroll is enabled (persisted, default true). */
let autoPulse = localStorage.getItem('autoPulse') !== 'false';

// ── Auth state ──────────────────────────────

/** Whether the server has auth enabled. */
let authEnabled = false;

/** Session token (persisted to localStorage). */
let authToken = localStorage.getItem('authToken') || null;

/** Current user's role (e.g. "admin", "manager"). */
let authRole = localStorage.getItem('authRole') || null;

/** Current user's display name. */
let authName = localStorage.getItem('authName') || null;

/** Department IDs this user is assigned to. */
let authDepts = JSON.parse(localStorage.getItem('authDepts') || '[]');

/** Whether current user holds the timer lock. */
let hasTimerLock = false;


// ── DOM cache ──────────────────────────────

/** Cached DOM element references — initialized once, reused everywhere. */
const DOM = {};

/** Populate DOM cache. Call once at startup from init(). */
function initDOM() {
  DOM.tcValue = document.getElementById('tc-value');
  DOM.tcState = document.getElementById('tc-state');
  DOM.tcFps = document.getElementById('tc-fps');
  DOM.tcSource = document.getElementById('tc-source');
  DOM.gotoTc = document.getElementById('goto-tc');
  DOM.gotoInfo = document.getElementById('goto-info');
  DOM.showNameLabel = document.getElementById('show-name-label');
  DOM.wsDot = document.getElementById('ws-dot');
  DOM.disconnectBanner = document.getElementById('disconnect-banner');
  DOM.flowTimecode = document.getElementById('flow-timecode');
  DOM.flowUpcoming = document.getElementById('flow-upcoming');
  DOM.toastContainer = document.getElementById('toast-container');
  DOM.deptList = document.getElementById('dept-list');
  DOM.cueListBody = document.getElementById('cue-list-body');
  DOM.timelineStrip = document.getElementById('timeline-strip');
  DOM.manageDeptFilter = document.getElementById('manage-dept-filter');
  DOM.deptFilters = document.getElementById('dept-filters');
  DOM.showSidebar = document.getElementById('show-sidebar');
  DOM.sidebarBackdrop = document.getElementById('sidebar-backdrop');
  DOM.loadingOverlay = document.getElementById('loading-overlay');
  DOM.autoPulseBtn = document.getElementById('autopulse-btn');
  // Auth
  DOM.loginOverlay = document.getElementById('login-overlay');
  DOM.loginForm = document.getElementById('login-form');
  DOM.loginName = document.getElementById('login-name');
  DOM.loginPin = document.getElementById('login-pin');
  DOM.loginError = document.getElementById('login-error');
  DOM.loginBtn = document.getElementById('login-btn');
  // Timer lock
  DOM.timerLockBtn = document.getElementById('timer-lock-btn');
  DOM.timerLockStatus = document.getElementById('timer-lock-status');
  // Admin dashboard (merged users + active connections)
  DOM.dashboardPanel = document.getElementById('dashboard-panel');
  DOM.dashboardBody = document.getElementById('dashboard-body');
  // Nav
  DOM.navTabs = document.querySelectorAll('.tab');
  DOM.logoutBtn = document.getElementById('logout-btn');
  DOM.authUserLabel = document.getElementById('auth-user-label');
  // Transport (for role gating)
  DOM.tcTransport = document.querySelector('.tc-transport');
  DOM.tcGotoGroup = document.querySelector('.tc-goto-group');
  // Act list (manage view)
  DOM.actList = document.getElementById('act-list');
}

// ── Shared helpers ─────────────────────────

/**
 * Format a cue label as "Q1 · Label" or just "Label" if no cue_number.
 * @param {Object} cue - Cue object with optional cue_number and label.
 * @returns {string} Formatted label string.
 */
function formatCueLabel(cue) {
  return cue.cue_number ? `${cue.cue_number}${CONST.BULLET}${cue.label}` : cue.label;
}

/**
 * Parse a timecode string "HH:MM:SS:FF" into an object.
 * @param {string} str - Timecode string.
 * @returns {{hours: number, minutes: number, seconds: number, frames: number}}
 */
function parseTC(str) {
  const p = (str || CONST.DEFAULT_TC).split(':').map(Number);
  return { hours: p[0] || 0, minutes: p[1] || 0, seconds: p[2] || 0, frames: p[3] || 0 };
}

/**
 * Format a timecode object as "HH:MM:SS:FF".
 * @param {{hours: number, minutes: number, seconds: number, frames: number}|null} tc
 * @returns {string}
 */
function fmtTC(tc) {
  if (!tc) return CONST.DEFAULT_TC;
  return [tc.hours, tc.minutes, tc.seconds, tc.frames]
    .map(v => String(v).padStart(2, '0')).join(':');
}

/**
 * Format countdown seconds as human-readable "T-Xm XXs" or "NOW".
 * @param {number} sec - Countdown seconds.
 * @returns {string}
 */
function fmtCountdown(sec) {
  if (sec <= 0) return 'NOW';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  if (m > 0) return `T-${m}m ${String(s).padStart(2, '0')}s`;
  return `T-${s}s`;
}

/**
 * Format elapsed seconds as "T+Xs" or "T+Xm XXs".
 * @param {number} sec - Elapsed seconds since trigger.
 * @returns {string}
 */
function fmtElapsed(sec) {
  if (sec <= 0) return 'T+0s';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  if (m > 0) return `T+${m}m ${String(s).padStart(2, '0')}s`;
  return `T+${s}s`;
}

/**
 * Convert a timecode string to total seconds.
 * @param {string} str - Timecode string "HH:MM:SS:FF".
 * @returns {number}
 */
function tcToSeconds(str) {
  const p = (str || CONST.DEFAULT_TC).split(':').map(Number);
  return (p[0] || 0) * 3600 + (p[1] || 0) * 60 + (p[2] || 0) + (p[3] || 0) / CONST.DEFAULT_FPS;
}

/**
 * Convert a timecode object to total seconds.
 * @param {{hours: number, minutes: number, seconds: number, frames: number}|null} tc
 * @returns {number}
 */
function tcObjToSeconds(tc) {
  if (!tc) return 0;
  return tc.hours * 3600 + tc.minutes * 60 + tc.seconds + tc.frames / CONST.DEFAULT_FPS;
}

/**
 * Convert a hex color + alpha to an rgba() string.
 * @param {string} hex - Hex color e.g. "#ff8800".
 * @param {number} alpha - Alpha value 0-1.
 * @returns {string}
 */
function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Get the color for a department by ID.
 * @param {string} id - Department UUID.
 * @returns {string} Hex color string.
 */
function getDeptColor(id) {
  const d = departments.find(d => d.id === id);
  return d ? d.color : CONST.DEFAULT_DEPT_COLOR;
}

/**
 * Get the warn_seconds for a cue by ID.
 * @param {string} deptId - Department UUID (unused but kept for API consistency).
 * @param {string} cueId - Cue UUID.
 * @returns {number}
 */
function getCueWarnMax(deptId, cueId) {
  const c = cues.find(c => c.id === cueId);
  return c ? c.warn_seconds : CONST.DEFAULT_WARN_SEC;
}

/**
 * Convert total seconds to a timecode object.
 * @param {number} totalSec - Total seconds.
 * @returns {{hours: number, minutes: number, seconds: number, frames: number}}
 */
function secondsToTcObj(totalSec) {
  totalSec = Math.max(0, totalSec);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  const f = Math.round((totalSec % 1) * CONST.DEFAULT_FPS);
  return { hours: h, minutes: m, seconds: s, frames: Math.min(f, CONST.DEFAULT_FPS - 1) };
}

/**
 * HTML-escape a string for safe insertion.
 * @param {string} s - Raw string.
 * @returns {string} Escaped HTML string.
 */
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/**
 * Generic save helper: create or update a resource via API.
 * @param {string} endpoint - Base API path (e.g. "/departments").
 * @param {string} id - Resource ID (empty string for create).
 * @param {Object} body - Request body.
 * @param {string} label - Human-readable resource name for toasts (e.g. "Department").
 * @returns {Promise<boolean>} True if successful.
 */
async function apiSave(endpoint, id, body, label) {
  try {
    if (id) {
      await api(`${endpoint}/${id}`, { method: 'PUT', body });
    } else {
      await api(endpoint, { method: 'POST', body });
    }
    showToast(id ? `${label} updated` : `${label} created`, 'success');
    return true;
  } catch (e) {
    showToast(`Failed to save ${label.toLowerCase()}: ${e.message}`, 'error');
    return false;
  }
}

/**
 * Generic delete helper: confirm then delete a resource via API.
 * @param {string} endpoint - Full API path with ID (e.g. "/departments/uuid").
 * @param {string} title - Confirm dialog title.
 * @param {string} message - Confirm dialog message.
 * @param {string} label - Human-readable resource name for toast.
 * @returns {Promise<boolean>} True if deleted.
 */
async function apiDelete(endpoint, title, message, label) {
  const ok = await showConfirm(title, message);
  if (!ok) return false;
  try {
    await api(endpoint, { method: 'DELETE' });
    showToast(`${label} deleted`, 'success');
    return true;
  } catch (e) {
    showToast(`Failed to delete ${label.toLowerCase()}: ${e.message}`, 'error');
    return false;
  }
}
