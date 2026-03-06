/* ══════════════════════════════════════════
   show.js — ShowView: rendering, sidebar, transport, cue navigation
   ══════════════════════════════════════════
   Handles all Show view logic: flow rendering, sidebar, transport controls,
   prev/next cue navigation, and department filters.
   Dependencies: state.js, api.js
   Components: ShowView, Sidebar, FlowArea,
               TimecodeDisplay, ReadyGoZone, CueList, FlowCard
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
 * Render all flow sections from WebSocket cue data.
 * All cues go to a single unified list; ReadyGo zone shows the nearest warning/go cue.
 * @param {Array<Object>} wsCues - Cue array from WebSocket message.
 */
function renderFlowCues(wsCues) {
  if (!wsCues || wsCues.length === 0) {
    renderReadyGo(DOM.flowReadygo, null);
    DOM.flowUpcoming.innerHTML = `<div class="flow-no-cues">${CONST.EMPTY_CUES_MSG}</div>`;
    return;
  }

  // Filter by active department filters
  let filtered = wsCues;
  if (activeDeptFilters.size > 0) {
    filtered = wsCues.filter(c => activeDeptFilters.has(c.department_id));
  }

  // Ready/Go: find the cue in "go" state first, then closest "warning" cue
  const goCues = filtered.filter(c => c.state === 'go');
  const warningCues = filtered.filter(c => c.state === 'warning');
  let readygoCue = null;
  if (goCues.length > 0) {
    readygoCue = goCues[0];
  } else if (warningCues.length > 0) {
    readygoCue = warningCues.reduce((a, b) => a.countdown_sec < b.countdown_sec ? a : b);
  }

  // All cues in one list (except the readygo cue which has its own zone), sorted by time
  const allCues = filtered
    .filter(c => !(readygoCue && c.id === readygoCue.id))
    .sort((a, b) => tcObjToSeconds(a.trigger_tc) - tcObjToSeconds(b.trigger_tc));

  renderReadyGo(DOM.flowReadygo, readygoCue);
  diffCueList(DOM.flowUpcoming, allCues);

  if (allCues.length === 0 && !readygoCue) {
    DOM.flowUpcoming.innerHTML = `<div class="flow-no-cues">${CONST.NO_MATCH_MSG}</div>`;
  }
}

// ── ReadyGo zone ───────────────────────────

/**
 * Calculate progress bar percentage for a ReadyGo cue (0% → 100%).
 * @param {Object} cue - Warning cue with countdown_sec.
 * @returns {number} Percentage 0-100.
 */
function readygoProgressPct(cue) {
  const warnMax = getCueWarnMax(cue.department_id, cue.id);
  return Math.max(0, Math.min(100, (1 - cue.countdown_sec / warnMax) * 100));
}

/**
 * Render the Ready/Go countdown zone for the nearest warning cue.
 * @param {HTMLElement} container - The #flow-readygo element.
 * @param {Object|null} cue - The closest warning cue, or null.
 */
function renderReadyGo(container, cue) {
  if (!cue) {
    container.classList.remove('visible', 'go-flash');
    container.innerHTML = '';
    delete container.dataset.cueId;
    readygoLastValue = null;
    return;
  }

  container.classList.add('visible');
  const isGo = cue.state === 'go';
  const cd = Math.ceil(cue.countdown_sec);
  let statusText, statusColor, digitText, digitColor, progressColor;

  const readyLabel = `READY${CONST.EMDASH}${cue.department}`;
  if (isGo) {
    statusText = `GO!${CONST.EMDASH}${cue.department}`;
    statusColor = 'var(--accent)';
    digitText = '';
    digitColor = '';
    progressColor = 'var(--accent)';
  } else if (cd > 3) {
    statusText = readyLabel;
    statusColor = 'var(--danger)';
    digitText = '';
    digitColor = '';
    progressColor = 'var(--danger)';
  } else if (cd === 3) {
    statusText = readyLabel;
    statusColor = CONST.COLOR_COUNTDOWN_3;
    digitText = '3';
    digitColor = CONST.COLOR_COUNTDOWN_3;
    progressColor = CONST.COLOR_COUNTDOWN_3;
  } else if (cd === 2) {
    statusText = readyLabel;
    statusColor = 'var(--warning)';
    digitText = '2';
    digitColor = 'var(--warning)';
    progressColor = 'var(--warning)';
  } else if (cd === 1) {
    statusText = readyLabel;
    statusColor = CONST.COLOR_COUNTDOWN_1;
    digitText = '1';
    digitColor = CONST.COLOR_COUNTDOWN_1;
    progressColor = CONST.COLOR_COUNTDOWN_1;
  } else {
    statusText = `GO!${CONST.EMDASH}${cue.department}`;
    statusColor = 'var(--accent)';
    digitText = '';
    digitColor = '';
    progressColor = 'var(--accent)';
  }

  const deptColor = getDeptColor(cue.department_id);
  const labelText = formatCueLabel(cue);
  const trackCueId = cue.id;
  const trackValue = isGo ? 'GO' : (digitText || statusText);

  // First render for this cue — build full DOM
  const existingCueId = container.dataset.cueId;
  if (existingCueId !== trackCueId) {
    container.dataset.cueId = trackCueId;
    container.classList.remove('go-flash');
    readygoLastValue = trackValue;

    const digitHtml = digitText
      ? `<span class="readygo-digit${cd === 1 ? ' shake' : ''}" style="color:${digitColor}">${digitText}</span>`
      : '<span class="readygo-digit" style="display:none"></span>';

    container.innerHTML = `<div class="readygo-info-row">
        <div class="dept-bar" style="background:${deptColor}"></div>
        <div class="readygo-info">
          <div class="readygo-label">${esc(labelText)}</div>
          <div class="readygo-dept">${esc(cue.department)}</div>
        </div>
        <div class="readygo-tc">${fmtTC(cue.trigger_tc)}</div>
      </div>
      <div class="readygo-countdown-row">
        <span class="readygo-status" style="color:${statusColor}">${esc(statusText)}</span>
        ${digitHtml}
      </div>
      <div class="readygo-progress"><div class="readygo-progress-fill" style="width:${isGo ? 100 : readygoProgressPct(cue)}%;background:${progressColor}"></div></div>`;

  } else {
    // In-place updates — preserve DOM elements and CSS transitions

    // GO flash animation on state transition
    if (readygoLastValue !== trackValue) {
      if (isGo && readygoLastValue !== 'GO') {
        container.classList.remove('go-flash');
        void container.offsetWidth;
        container.classList.add('go-flash');
      } else if (!isGo) {
        container.classList.remove('go-flash');
      }
      readygoLastValue = trackValue;
    }

    // Update status text and color
    const statusEl = container.querySelector('.readygo-status');
    if (statusEl) {
      const escapedStatus = esc(statusText);
      if (statusEl.innerHTML !== escapedStatus) statusEl.innerHTML = escapedStatus;
      statusEl.style.color = statusColor;
    }

    // Update digit
    const digitEl = container.querySelector('.readygo-digit');
    if (digitEl) {
      if (digitText) {
        digitEl.style.display = '';
        if (digitEl.textContent !== digitText) {
          digitEl.textContent = digitText;
          // Re-trigger pop animation
          digitEl.className = 'readygo-digit' + (cd === 1 ? ' shake' : '');
          void digitEl.offsetWidth;
        }
        digitEl.style.color = digitColor;
      } else {
        digitEl.style.display = 'none';
      }
    }

    // Update progress bar (smooth — element is preserved)
    const fillEl = container.querySelector('.readygo-progress-fill');
    if (fillEl) {
      fillEl.style.width = (isGo ? 100 : readygoProgressPct(cue)) + '%';
      fillEl.style.background = progressColor;
    }
  }
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
    <div class="progress-bg"><div class="progress-fill"></div></div>`;

  if (tint) card.style.background = tint;
  updateFlowCard(card, c);
  return card;
}

/**
 * Update an existing flow card's tier, label, countdown, and progress bar.
 * @param {HTMLElement} card - The card DOM element.
 * @param {Object} c - Updated cue object.
 */
function updateFlowCard(card, c) {
  const tier = getTier(c);
  const newClass = `flow-card ${tier}`;
  if (card.className !== newClass) card.className = newClass;
  card.dataset.triggerTc = fmtTC(c.trigger_tc);

  // Dept tint for active/warning
  const deptColor = getDeptColor(c.department_id);
  if (tier === 'tier-active' || tier === 'tier-warning') {
    card.style.background = hexToRgba(deptColor, CONST.TINT_ALPHA);
  } else {
    card.style.background = '';
  }

  // Label
  const labelEl = card.querySelector('.card-label');
  const labelText = formatCueLabel(c);
  if (labelEl.textContent !== labelText) labelEl.textContent = labelText;

  // Countdown text + color
  const cdEl = card.querySelector('.card-countdown');
  const cdText = (c.state === 'passed' || c.state === 'active') ? CONST.CHECKMARK : (c.state === 'go' ? 'GO!' : fmtCountdown(c.countdown_sec));
  if (cdEl.textContent !== cdText) cdEl.textContent = cdText;
  if (c.state === 'active') {
    cdEl.style.color = 'var(--accent)';
  } else {
    cdEl.style.color = '';
  }

  // Progress bar — fills from 0% → 100% over the warn window
  const fillEl = card.querySelector('.progress-fill');
  if (c.state === 'passed' || c.state === 'active' || c.state === 'go') {
    fillEl.style.width = '100%';
  } else {
    const warnMax = getCueWarnMax(c.department_id, c.id);
    const pct = Math.max(0, Math.min(100, (1 - c.countdown_sec / warnMax) * 100));
    fillEl.style.width = pct + '%';
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

