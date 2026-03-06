/* ══════════════════════════════════════════
   state.js — Constants, global state, DOM cache, shared utilities
   ══════════════════════════════════════════
   Loaded first. Provides CONST, DOM cache, and helpers used by all modules.
   Dependencies: none
   Components: All
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
};

// ── Global state ───────────────────────────

/** @type {Array<{id: string, name: string, color: string}>} */
let departments = [];

/** @type {Array<Object>} */
let cues = [];

/** Active department filter IDs — empty means show all. */
let activeDeptFilters = new Set();

/** @type {WebSocket|null} */
let ws = null;

/** Whether the WebSocket is currently connected. */
let wsConnected = false;

/** Current sort configuration for the cue table. */
let cueTableSort = { key: 'trigger_tc', asc: true };

/** Resolve function for the confirm modal promise. */
let confirmResolve = null;

/** Whether the sidebar is open (persisted to localStorage). */
let sidebarOpen = localStorage.getItem('sidebarOpen') === 'true';

/** Tracks the last Ready/Go countdown value to detect transitions. */
let readygoLastValue = null;

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
  DOM.wsDot = document.getElementById('ws-dot');
  DOM.disconnectBanner = document.getElementById('disconnect-banner');
  DOM.flowTimecode = document.getElementById('flow-timecode');
  DOM.flowReadygo = document.getElementById('flow-readygo');
  DOM.flowUpcoming = document.getElementById('flow-upcoming');
  DOM.toastContainer = document.getElementById('toast-container');
  DOM.deptList = document.getElementById('dept-list');
  DOM.cueTableBody = document.getElementById('cue-table-body');
  DOM.manageDeptFilter = document.getElementById('manage-dept-filter');
  DOM.deptFilters = document.getElementById('dept-filters');
  DOM.showSidebar = document.getElementById('show-sidebar');
  DOM.sidebarBackdrop = document.getElementById('sidebar-backdrop');
  DOM.loadingOverlay = document.getElementById('loading-overlay');
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
 * HTML-escape a string for safe insertion.
 * @param {string} s - Raw string.
 * @returns {string} Escaped HTML string.
 */
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
