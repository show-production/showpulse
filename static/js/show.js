/* ══════════════════════════════════════════
   show.js — ShowView: rendering, sidebar, transport, cue navigation
   ══════════════════════════════════════════
   Handles all Show view logic: flow rendering, sidebar, transport controls,
   prev/next cue navigation, and department filters.
   Dependencies: state.js, api.js
   Components: ShowView, Sidebar, FlowArea,
               TimecodeDisplay, CueList, FlowCard
   ══════════════════════════════════════════ */

// ── Sidebar ────────────────────────────────

/**
 * Toggle the sidebar open/closed.
 * @param {boolean} [forceState] - Force open (true) or closed (false).
 */
function toggleSidebar(forceState) {
  sidebarOpen = forceState !== undefined ? forceState : !sidebarOpen;
  DOM.showSidebar.classList.toggle('open', sidebarOpen);
  DOM.sidebarBackdrop.classList.toggle('visible', sidebarOpen);
  localStorage.setItem('sidebarOpen', sidebarOpen);
}

// ── Transport controls ─────────────────────

/**
 * Send a generator transport command (play/pause/stop).
 * @param {string} cmd - Command name.
 */
async function genCmd(cmd) {
  try {
    await api(`/generator/${cmd}`, { method: 'POST' });
  } catch (e) {
    showToast(`Command failed: ${e.message}`, 'error');
  }
}

/**
 * Jump to the timecode entered in the goto input field.
 */
async function gotoTC() {
  const val = DOM.gotoTc.value;
  const tc = parseTC(val);
  try {
    await api('/generator/goto', { method: 'POST', body: { timecode: tc } });
  } catch (e) {
    showToast(`Goto failed: ${e.message}`, 'error');
  }
}

// ── Cue navigation ─────────────────────────

/**
 * Navigate to the previous cue (before current timecode).
 */
function prevCue() {
  const currentSecs = tcToSeconds(DOM.tcValue.textContent);
  const sorted = getSortedCueTCs();
  let best = null;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].secs < currentSecs - 0.5) { best = sorted[i]; break; }
  }
  if (best) DOM.gotoTc.value = best.tc;
}

/**
 * Navigate to the next cue (after current timecode).
 */
function nextCue() {
  const currentSecs = tcToSeconds(DOM.tcValue.textContent);
  const sorted = getSortedCueTCs();
  let best = null;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].secs > currentSecs + 0.5) { best = sorted[i]; break; }
  }
  if (best) DOM.gotoTc.value = best.tc;
}

/**
 * Get all cue timecodes sorted by time, filtered by active dept filters.
 * @returns {Array<{tc: string, secs: number}>}
 */
function getSortedCueTCs() {
  let list = cues;
  if (activeDeptFilters.size > 0) {
    list = cues.filter(c => activeDeptFilters.has(c.department_id));
  }
  return list
    .map(c => ({ tc: fmtTC(c.trigger_tc), secs: tcObjToSeconds(c.trigger_tc) }))
    .sort((a, b) => a.secs - b.secs);
}

// ── Tier classification ────────────────────

/**
 * Determine the display tier for a cue based on its state and countdown.
 * @param {Object} c - Cue object with state and countdown_sec.
 * @returns {string} Tier class name.
 */
function getTier(c) {
  if (c.state === 'passed') return 'tier-passed';
  if (c.state === 'active') return 'tier-active';
  if (c.state === 'go') return 'tier-warning';
  if (c.state === 'warning') return 'tier-warning';
  if (c.countdown_sec <= CONST.TIER_NEAR_SEC) return 'tier-near';
  if (c.countdown_sec <= CONST.TIER_FAR_SEC) return 'tier-far';
  return 'tier-distant';
}

// ── Flow rendering (main entry) ────────────

/**
 * Render all cues in a single unified list sorted by trigger time.
 * Warning/go cues show inline countdown (READY/3/2/1/GO!) on the card itself.
 * @param {Array<Object>} wsCues - Cue array from WebSocket message.
 */
function renderFlowCues(wsCues) {
  if (!wsCues || wsCues.length === 0) {
    DOM.flowUpcoming.innerHTML = `<div class="flow-no-cues">${CONST.EMPTY_CUES_MSG}</div>`;
    return;
  }

  // Filter by active department filters
  let filtered = wsCues;
  if (activeDeptFilters.size > 0) {
    filtered = wsCues.filter(c => activeDeptFilters.has(c.department_id));
  }

  // All cues in unified list sorted by time — no extraction, no jumps
  const allCues = filtered
    .slice()
    .sort((a, b) => tcObjToSeconds(a.trigger_tc) - tcObjToSeconds(b.trigger_tc));

  diffCueList(DOM.flowUpcoming, allCues);

  if (allCues.length === 0) {
    DOM.flowUpcoming.innerHTML = `<div class="flow-no-cues">${CONST.NO_MATCH_MSG}</div>`;
  }
}

// ── Traffic-light color helper ──────────────

/**
 * Get traffic-light color values for a warning/go cue.
 * @param {Object} c - Cue with state and countdown_sec.
 * @returns {{statusText: string, statusColor: string, digitText: string, digitColor: string, progressColor: string}}
 */
function getTrafficLight(c) {
  const isGo = c.state === 'go';
  const cd = Math.ceil(c.countdown_sec);
  const dept = c.department;

  if (isGo || cd <= 0) {
    return { statusText: `GO!${CONST.EMDASH}${dept}`, statusColor: 'var(--accent)', digitText: '', digitColor: '', progressColor: 'var(--accent)' };
  }
  const readyLabel = `READY${CONST.EMDASH}${dept}`;
  if (cd > 3) {
    return { statusText: readyLabel, statusColor: 'var(--danger)', digitText: '', digitColor: '', progressColor: 'var(--danger)' };
  }
  if (cd === 3) {
    return { statusText: readyLabel, statusColor: CONST.COLOR_COUNTDOWN_3, digitText: '3', digitColor: CONST.COLOR_COUNTDOWN_3, progressColor: CONST.COLOR_COUNTDOWN_3 };
  }
  if (cd === 2) {
    return { statusText: readyLabel, statusColor: 'var(--warning)', digitText: '2', digitColor: 'var(--warning)', progressColor: 'var(--warning)' };
  }
  // cd === 1
  return { statusText: readyLabel, statusColor: CONST.COLOR_COUNTDOWN_1, digitText: '1', digitColor: CONST.COLOR_COUNTDOWN_1, progressColor: CONST.COLOR_COUNTDOWN_1 };
}

// ── FlowCard list (DOM-diffed) ─────────────

/**
 * DOM-diff the upcoming cue list — update, add, or remove cards as needed.
 * @param {HTMLElement} container - The #flow-upcoming element.
 * @param {Array<Object>} cueList - Array of cue objects to display.
 */
function diffCueList(container, cueList) {
  const existingCards = container.querySelectorAll('.flow-card');
  const existingMap = {};
  existingCards.forEach(card => { existingMap[card.dataset.cueId] = card; });

  const wantedIds = new Set(cueList.map(c => c.id));

  // Remove cards no longer wanted
  existingCards.forEach(card => {
    if (!wantedIds.has(card.dataset.cueId)) card.remove();
  });

  // Update or create in order
  let prevNode = null;
  cueList.forEach(c => {
    let card = existingMap[c.id];
    if (card) {
      updateFlowCard(card, c);
      if (prevNode) {
        if (prevNode.nextElementSibling !== card) prevNode.after(card);
      } else if (container.firstElementChild !== card) {
        container.prepend(card);
      }
    } else {
      card = createFlowCard(c);
      if (prevNode) {
        prevNode.after(card);
      } else {
        container.prepend(card);
      }
    }
    prevNode = card;
  });

  // Remove trailing non-card elements
  while (prevNode && prevNode.nextElementSibling) {
    prevNode.nextElementSibling.remove();
  }
}

/**
 * Create a new flow card DOM element for a cue.
 * @param {Object} c - Cue object.
 * @returns {HTMLElement}
 */
function createFlowCard(c) {
  const deptColor = getDeptColor(c.department_id);
  const tier = getTier(c);
  const card = document.createElement('div');
  card.className = `flow-card ${tier}`;
  card.dataset.cueId = c.id;
  card.dataset.triggerTc = fmtTC(c.trigger_tc);

  card.addEventListener('click', () => {
    DOM.gotoTc.value = card.dataset.triggerTc;
  });

  const tint = (tier === 'tier-active' || tier === 'tier-warning') ? hexToRgba(deptColor, CONST.TINT_ALPHA) : '';

  card.innerHTML = `<div class="dept-bar" style="background:${deptColor}"></div>
    <div class="card-info">
      <div class="card-label"></div>
      <div class="card-dept">${esc(c.department)}</div>
    </div>
    <div class="card-tc">${fmtTC(c.trigger_tc)}</div>
    <div class="card-countdown"></div>
    <div class="card-countdown-row">
      <span class="card-status"></span>
      <span class="card-digit"></span>
    </div>
    <div class="progress-bg"><div class="progress-fill"></div></div>`;

  if (tint) card.style.background = tint;
  updateFlowCard(card, c);
  return card;
}

/**
 * Update an existing flow card's tier, label, countdown, progress bar,
 * and inline READY/GO countdown row for warning/go cues.
 * @param {HTMLElement} card - The card DOM element.
 * @param {Object} c - Updated cue object.
 */
function updateFlowCard(card, c) {
  const tier = getTier(c);
  const isWarningTier = (tier === 'tier-warning');

  // Preserve go-flash class during animation, otherwise sync tier
  const hasGoFlash = card.classList.contains('go-flash');
  const newClass = `flow-card ${tier}${hasGoFlash ? ' go-flash' : ''}`;
  if (card.className !== newClass) card.className = newClass;
  card.dataset.triggerTc = fmtTC(c.trigger_tc);

  // Dept tint for active/warning
  const deptColor = getDeptColor(c.department_id);
  if (tier === 'tier-active' || isWarningTier) {
    card.style.background = hexToRgba(deptColor, CONST.TINT_ALPHA);
  } else {
    card.style.background = '';
  }

  // Label
  const labelEl = card.querySelector('.card-label');
  const labelText = formatCueLabel(c);
  if (labelEl.textContent !== labelText) labelEl.textContent = labelText;

  // Countdown text (top-right of card)
  const cdEl = card.querySelector('.card-countdown');
  let cdText, cdColor = '';
  if (c.state === 'passed' || c.state === 'active') {
    cdText = CONST.CHECKMARK;
    cdColor = c.state === 'active' ? 'var(--accent)' : '';
  } else if (isWarningTier) {
    // Hide the small countdown — the inline row shows READY/digit/GO instead
    cdText = '';
    cdColor = '';
  } else {
    cdText = fmtCountdown(c.countdown_sec);
  }
  if (cdEl.textContent !== cdText) cdEl.textContent = cdText;
  cdEl.style.color = cdColor;

  // Inline countdown row (READY / 3 / 2 / 1 / GO!) — visible only for warning tier
  const statusEl = card.querySelector('.card-status');
  const digitEl = card.querySelector('.card-digit');
  if (isWarningTier) {
    const tl = getTrafficLight(c);

    // Status text + color
    const escapedStatus = esc(tl.statusText);
    if (statusEl.innerHTML !== escapedStatus) statusEl.innerHTML = escapedStatus;
    statusEl.style.color = tl.statusColor;

    // Digit (3/2/1) with pop/shake animation
    if (tl.digitText) {
      digitEl.style.display = '';
      if (digitEl.textContent !== tl.digitText) {
        digitEl.textContent = tl.digitText;
        const cd = Math.ceil(c.countdown_sec);
        digitEl.className = 'card-digit' + (cd === 1 ? ' shake' : '');
        void digitEl.offsetWidth; // re-trigger animation
      }
      digitEl.style.color = tl.digitColor;
    } else {
      digitEl.style.display = 'none';
      digitEl.textContent = '';
    }

    // GO flash animation on card
    const isGo = c.state === 'go';
    const lastCd = card.dataset.lastCd || '';
    const currentCd = isGo ? 'GO' : (tl.digitText || 'READY');
    if (lastCd !== currentCd) {
      if (isGo && lastCd !== 'GO') {
        card.classList.remove('go-flash');
        void card.offsetWidth;
        card.classList.add('go-flash');
      } else if (!isGo) {
        card.classList.remove('go-flash');
      }
    }
    card.dataset.lastCd = currentCd;
  } else {
    // Not warning — clear countdown row state
    if (statusEl.textContent) statusEl.textContent = '';
    if (digitEl.textContent) { digitEl.textContent = ''; digitEl.style.display = 'none'; }
    if (card.dataset.lastCd) delete card.dataset.lastCd;
    card.classList.remove('go-flash');
  }

  // Progress bar — fills from 0% → 100% over the warn window
  const fillEl = card.querySelector('.progress-fill');
  if (c.state === 'passed' || c.state === 'active' || c.state === 'go') {
    fillEl.style.width = '100%';
    fillEl.style.background = (c.state === 'go') ? 'var(--accent)' : '';
  } else if (c.state === 'warning') {
    const warnMax = getCueWarnMax(c.department_id, c.id);
    const pct = Math.max(0, Math.min(100, (1 - c.countdown_sec / warnMax) * 100));
    fillEl.style.width = pct + '%';
    fillEl.style.background = getTrafficLight(c).progressColor;
  } else {
    const warnMax = getCueWarnMax(c.department_id, c.id);
    const pct = Math.max(0, Math.min(100, (1 - c.countdown_sec / warnMax) * 100));
    fillEl.style.width = pct + '%';
    fillEl.style.background = '';
  }
}

// ── Department filters ─────────────────────

/**
 * Render department filter chips in the sidebar.
 */
function renderDeptFilters() {
  let html = `<span class="dept-chip ${activeDeptFilters.size === 0 ? 'active' : ''}" onclick="clearDeptFilters()">All</span>`;
  departments.forEach(d => {
    const active = activeDeptFilters.has(d.id) ? 'active' : '';
    html += `<span class="dept-chip ${active}" onclick="toggleDeptFilter('${d.id}')">
      <span class="chip-dot" style="background:${d.color}"></span>${esc(d.name)}</span>`;
  });
  DOM.deptFilters.innerHTML = html;
}

/**
 * Toggle a department filter on/off.
 * @param {string} id - Department UUID.
 */
function toggleDeptFilter(id) {
  if (activeDeptFilters.has(id)) activeDeptFilters.delete(id);
  else activeDeptFilters.add(id);
  renderDeptFilters();
}

/**
 * Clear all department filters (show all).
 */
function clearDeptFilters() {
  activeDeptFilters.clear();
  renderDeptFilters();
}

