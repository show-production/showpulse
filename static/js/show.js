/* ══════════════════════════════════════════
   show.js — Show view: flow rendering, transport, cue navigation
   ══════════════════════════════════════════
   Sections:
     Sidebar         — toggle, dept filter chips
     Transport       — play/pause/stop, goto, timer-lock guard
     Cue navigation  — prev/next, goto cue info display
     Tier + color    — tier classification, traffic-light colors
     Flow rendering  — act-grouped DOM-diff, card create/update
     Warning row     — inline READY/3/2/1/GO countdown on cards
     Progress bar    — fill animation per cue state
     AutoPulse       — auto-scroll + jump-to-current
     Collapse/expand — act group folding
     Dept filters    — sidebar filter chips
   Dependencies: state.js, api.js
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
 * Check if the current user is allowed to control the timer.
 * Managers must hold the timer lock; others pass through.
 * @returns {boolean} True if allowed.
 */
function canControlTimer() {
  if (authEnabled && authRole === 'manager' && !hasTimerLock) {
    showToast(t('timer.acquireFirst'), 'error');
    return false;
  }
  return true;
}

/**
 * Send a generator transport command (play/pause/stop).
 * @param {string} cmd - Command name.
 */
async function genCmd(cmd) {
  if (!canControlTimer()) return;
  try {
    await api(`/generator/${cmd}`, { method: 'POST' });
  } catch (e) {
    showToast(e.message.includes('403') ? t('timer.required') : `Command failed: ${e.message}`, 'error');
  }
}

/**
 * Jump to the timecode entered in the goto input field.
 */
async function gotoTC() {
  if (!canControlTimer()) return;
  try {
    await api('/generator/goto', { method: 'POST', body: { timecode: parseTC(DOM.gotoTc.value) } });
  } catch (e) {
    showToast(e.message.includes('403') ? t('timer.required') : `Goto failed: ${e.message}`, 'error');
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
  if (best) {
    DOM.gotoTc.value = best.tc;
    showGotoCueInfo(best);
  }
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
  if (best) {
    DOM.gotoTc.value = best.tc;
    showGotoCueInfo(best);
  }
}

/**
 * Get all cue timecodes sorted by time, filtered by active dept filters.
 * @returns {Array<{tc: string, secs: number, department_id: string, department: string, label: string}>}
 */
function getSortedCueTCs() {
  let list = cues;
  if (activeDeptFilters.size > 0) {
    list = cues.filter(c => activeDeptFilters.has(c.department_id));
  }
  return list
    .map(c => ({
      tc: fmtTC(c.trigger_tc),
      secs: tcObjToSeconds(c.trigger_tc),
      department_id: c.department_id,
      department: c.department,
      label: formatCueLabel(c),
    }))
    .sort((a, b) => a.secs - b.secs);
}

/**
 * Display cue info (department + label) in the goto info area.
 * @param {{department_id: string, department: string, label: string}} info
 */
function showGotoCueInfo(info) {
  const color = getDeptColor(info.department_id);
  DOM.gotoInfo.innerHTML =
    `<span class="goto-dept-dot" style="background:${color}"></span>` +
    `<span class="goto-dept-name">${esc(info.department)}</span>` +
    `<span class="goto-cue-label">${esc(info.label)}</span>`;
}

/**
 * Update goto cue info when user types in the goto input.
 * Finds a cue matching the entered timecode and shows its info.
 */
function updateGotoCueInfo() {
  const val = DOM.gotoTc.value.trim();
  if (!val) { DOM.gotoInfo.innerHTML = `<span class="goto-hint">${t('transport.gotoHint')}</span>`; return; }
  const sorted = getSortedCueTCs();
  const match = sorted.find(c => c.tc === val);
  if (match) {
    showGotoCueInfo(match);
  } else {
    DOM.gotoInfo.innerHTML = '';
  }
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
    DOM.flowUpcoming.innerHTML = `<div class="flow-no-cues">${t('cue.noCues')}</div>`;
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

  diffCueListWithActs(DOM.flowUpcoming, allCues);

  if (allCues.length === 0) {
    DOM.flowUpcoming.innerHTML = `<div class="flow-no-cues">${t('cue.noMatch')}</div>`;
  }

  autoScrollCueList();
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
    return { statusText: `${t('cue.go')}${CONST.EMDASH}${dept}`, statusColor: 'var(--accent)', digitText: '', digitColor: '', progressColor: 'var(--accent)' };
  }
  const readyLabel = `${t('cue.ready')}${CONST.EMDASH}${dept}`;
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

// ── FlowCard list with act grouping ─────────

/**
 * Render cues grouped by act with sticky divider headers.
 * Cues without an act go into an "ungrouped" section at the end.
 * @param {HTMLElement} container - The #flow-upcoming element.
 * @param {Array<Object>} cueList - Array of cue objects sorted by time.
 */
function diffCueListWithActs(container, cueList) {
  // Group cues by act_id (preserving time order within each group)
  const grouped = new Map();
  const ungrouped = [];
  for (const c of cueList) {
    if (c.act_id && c.act_name) {
      if (!grouped.has(c.act_id)) grouped.set(c.act_id, []);
      grouped.get(c.act_id).push(c);
    } else {
      ungrouped.push(c);
    }
  }

  // If no acts exist, treat all cues as ungrouped
  if (grouped.size === 0) {
    container.querySelectorAll('.act-group').forEach(g => g.remove());
    // Fall through — ungrouped array has all cues
  }

  // Build ordered act groups (sorted by earliest cue time)
  const actOrder = [...grouped.entries()]
    .map(([actId, actCues]) => ({
      actId,
      actName: actCues[0].act_name,
      cues: actCues,
      firstTime: tcObjToSeconds(actCues[0].trigger_tc),
    }))
    .sort((a, b) => a.firstTime - b.firstTime);

  const wantedActIds = new Set(actOrder.map(a => a.actId));
  const wantedCueIds = new Set(cueList.map(c => c.id));

  // Index existing act-group wrappers
  const existingGroups = {};
  container.querySelectorAll('.act-group').forEach(g => {
    if (wantedActIds.has(g.dataset.actId)) {
      existingGroups[g.dataset.actId] = g;
    } else {
      g.remove();
    }
  });

  // Remove stale orphan cards (outside groups)
  container.querySelectorAll(':scope > .flow-card').forEach(card => {
    if (!wantedCueIds.has(card.dataset.cueId)) card.remove();
  });

  let prevNode = null;

  for (const act of actOrder) {
    // Get or create act-group wrapper
    let group = existingGroups[act.actId];
    const wasCollapsed = group ? group.classList.contains('collapsed') : false;
    if (!group) {
      group = document.createElement('div');
      group.className = 'act-group';
      group.dataset.actId = act.actId;
    }

    // Get or create header inside group
    let header = group.querySelector('.act-header');
    if (!header) {
      header = document.createElement('div');
      header.className = 'act-header';
      header.dataset.actId = act.actId;
      header.addEventListener('dblclick', () => toggleActGroup(group));
      group.prepend(header);
    }
    if (header.textContent !== act.actName) header.textContent = act.actName;

    // Preserve collapsed state
    if (wasCollapsed) {
      group.classList.add('collapsed');
      header.classList.add('collapsed');
    }

    // Position group in container
    if (prevNode) {
      if (prevNode.nextElementSibling !== group) prevNode.after(group);
    } else if (container.firstElementChild !== group) {
      container.prepend(group);
    }

    // Diff cards inside this group
    const existingCards = {};
    group.querySelectorAll('.flow-card').forEach(card => {
      existingCards[card.dataset.cueId] = card;
    });

    let prevCard = header;
    for (const c of act.cues) {
      let card = existingCards[c.id];
      if (card) {
        updateFlowCard(card, c);
        delete existingCards[c.id];
        if (prevCard.nextElementSibling !== card) prevCard.after(card);
      } else {
        card = createFlowCard(c);
        prevCard.after(card);
      }
      prevCard = card;
    }
    // Remove stale cards in this group
    Object.values(existingCards).forEach(card => card.remove());

    prevNode = group;
  }

  // Ungrouped cues after all groups
  for (const c of ungrouped) {
    let card = container.querySelector(`.flow-card[data-cue-id="${c.id}"]`);
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
  }

  // Remove trailing stale elements
  while (prevNode && prevNode.nextElementSibling) {
    prevNode.nextElementSibling.remove();
  }
}

// ── Act group collapse/expand ─────────────

/**
 * Toggle collapse state of a single act group.
 * @param {HTMLElement} group - The .act-group element.
 */
function toggleActGroup(group) {
  const collapsed = group.classList.toggle('collapsed');
  const header = group.querySelector('.act-header');
  if (header) header.classList.toggle('collapsed', collapsed);
}

/** Collapse all act groups, hiding their cue cards. */
function collapseAllActs() {
  DOM.flowUpcoming.querySelectorAll('.act-group').forEach(g => {
    g.classList.add('collapsed');
    const h = g.querySelector('.act-header');
    if (h) h.classList.add('collapsed');
  });
}

/** Expand all act groups, showing their cue cards. */
function expandAllActs() {
  DOM.flowUpcoming.querySelectorAll('.act-group').forEach(g => {
    g.classList.remove('collapsed');
    const h = g.querySelector('.act-header');
    if (h) h.classList.remove('collapsed');
  });
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
    showGotoCueInfo({
      department_id: c.department_id,
      department: c.department,
      label: formatCueLabel(c),
    });
  });

  const tint = (tier === 'tier-warning') ? hexToRgba(deptColor, CONST.TINT_ALPHA) : '';

  card.innerHTML = `<div class="dept-bar" style="background:${deptColor}"></div>
    <div class="card-info">
      <div class="card-label"></div>
      <div class="card-dept"><span class="dept-dot" style="background:${deptColor}"></span>${esc(c.department)}</div>
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
 * Update the inline READY/3/2/1/GO countdown row on a warning-tier card.
 * @param {HTMLElement} card - The card DOM element.
 * @param {Object} c - Cue object.
 */
function updateWarningRow(card, c) {
  const statusEl = card.querySelector('.card-status');
  const digitEl = card.querySelector('.card-digit');
  const tl = getTrafficLight(c);

  const escapedStatus = esc(tl.statusText);
  if (statusEl.innerHTML !== escapedStatus) statusEl.innerHTML = escapedStatus;
  statusEl.style.color = tl.statusColor;

  if (tl.digitText) {
    digitEl.style.display = '';
    if (digitEl.textContent !== tl.digitText) {
      digitEl.textContent = tl.digitText;
      digitEl.className = 'card-digit' + (Math.ceil(c.countdown_sec) === 1 ? ' shake' : '');
      void digitEl.offsetWidth;
    }
    digitEl.style.color = tl.digitColor;
  } else {
    digitEl.style.display = 'none';
    digitEl.textContent = '';
  }

  // GO flash animation
  const currentCd = c.state === 'go' ? 'GO' : (tl.digitText || 'READY');
  const lastCd = card.dataset.lastCd || '';
  if (lastCd !== currentCd) {
    if (c.state === 'go' && lastCd !== 'GO') {
      card.classList.remove('go-flash');
      void card.offsetWidth;
      card.classList.add('go-flash');
    } else if (c.state !== 'go') {
      card.classList.remove('go-flash');
    }
  }
  card.dataset.lastCd = currentCd;
}

/**
 * Clear the countdown row state when a card leaves warning tier.
 * @param {HTMLElement} card - The card DOM element.
 */
function clearWarningRow(card) {
  const statusEl = card.querySelector('.card-status');
  const digitEl = card.querySelector('.card-digit');
  if (statusEl.textContent) statusEl.textContent = '';
  if (digitEl.textContent) { digitEl.textContent = ''; digitEl.style.display = 'none'; }
  if (card.dataset.lastCd) delete card.dataset.lastCd;
  card.classList.remove('go-flash');
}

/**
 * Update the progress bar fill on a flow card.
 * @param {HTMLElement} card - The card DOM element.
 * @param {Object} c - Cue object.
 */
function updateProgressBar(card, c) {
  const fillEl = card.querySelector('.progress-fill');
  if (c.state === 'passed' || c.state === 'active' || c.state === 'go') {
    fillEl.style.width = '100%';
    fillEl.style.background = (c.state === 'go') ? 'var(--accent)' : '';
  } else {
    const warnMax = getCueWarnMax(c.department_id, c.id);
    const pct = Math.max(0, Math.min(100, (1 - c.countdown_sec / warnMax) * 100));
    fillEl.style.width = pct + '%';
    fillEl.style.background = c.state === 'warning' ? getTrafficLight(c).progressColor : '';
  }
}

/**
 * Update an existing flow card's tier, label, countdown, and progress.
 * @param {HTMLElement} card - The card DOM element.
 * @param {Object} c - Updated cue object.
 */
function updateFlowCard(card, c) {
  const tier = getTier(c);
  const isWarning = (tier === 'tier-warning');

  // Sync tier class (preserve go-flash during animation)
  const hasGoFlash = card.classList.contains('go-flash');
  const newClass = `flow-card ${tier}${hasGoFlash ? ' go-flash' : ''}`;
  if (card.className !== newClass) card.className = newClass;
  card.dataset.triggerTc = fmtTC(c.trigger_tc);

  // Dept color (bar + dot + warning tint)
  const deptColor = getDeptColor(c.department_id);
  card.style.background = isWarning ? hexToRgba(deptColor, CONST.TINT_ALPHA) : '';
  const barEl = card.querySelector('.dept-bar');
  if (barEl) barEl.style.background = deptColor;
  const dotEl = card.querySelector('.dept-dot');
  if (dotEl) dotEl.style.background = deptColor;

  // Label
  const labelEl = card.querySelector('.card-label');
  const labelText = formatCueLabel(c);
  if (labelEl.textContent !== labelText) labelEl.textContent = labelText;

  // Countdown badge (top-right) — always visible
  const cdEl = card.querySelector('.card-countdown');
  let cdText, cdColor = '';
  if (c.state === 'passed' || c.state === 'active') {
    cdText = c.elapsed_sec != null ? fmtElapsed(c.elapsed_sec) : CONST.CHECKMARK;
    cdColor = 'var(--text-dim)';
  } else {
    cdText = fmtCountdown(c.countdown_sec);
  }
  if (cdEl.textContent !== cdText) cdEl.textContent = cdText;
  cdEl.style.color = cdColor;

  // Warning row (READY/3/2/1/GO!)
  if (isWarning) updateWarningRow(card, c);
  else clearWarningRow(card);

  // Progress bar
  updateProgressBar(card, c);
}

// ── AutoPulse + Jump to current ─────────────

/**
 * Toggle AutoPulse auto-scroll on/off.
 * @param {boolean} [forceState] - Force on (true) or off (false).
 */
function toggleAutoPulse(forceState) {
  autoPulse = forceState !== undefined ? forceState : !autoPulse;
  localStorage.setItem('autoPulse', autoPulse);
  DOM.autoPulseBtn.classList.toggle('active', autoPulse);
  if (autoPulse) autoScrollCueList();
}

/** Block user scroll on the cue list when AutoPulse is on. */
function initAutoPulseScrollBlock() {
  DOM.flowUpcoming.addEventListener('wheel', (e) => {
    if (autoPulse) e.preventDefault();
  }, { passive: false });
  DOM.flowUpcoming.addEventListener('touchmove', (e) => {
    if (autoPulse) e.preventDefault();
  }, { passive: false });
}

/**
 * Find the "current action" card: first warning/go cue (counting down),
 * or first upcoming cue if none are in warning/go state.
 * @returns {HTMLElement|null}
 */
function findCurrentCard() {
  const warm = DOM.flowUpcoming.querySelector('.flow-card.tier-warning');
  if (warm) return warm;
  const cards = DOM.flowUpcoming.querySelectorAll('.flow-card');
  for (const card of cards) {
    if (!card.classList.contains('tier-passed') && !card.classList.contains('tier-active')) {
      return card;
    }
  }
  return null;
}

/**
 * Auto-scroll cue list so the warm/next cue is at the top.
 * Only runs when AutoPulse is enabled. Uses instant scroll (called at 10Hz).
 */
function autoScrollCueList() {
  if (!autoPulse) return;
  const target = findCurrentCard();
  if (target) {
    const containerTop = DOM.flowUpcoming.getBoundingClientRect().top;
    const targetTop = target.getBoundingClientRect().top;
    DOM.flowUpcoming.scrollTop += (targetTop - containerTop);
  }
}

/**
 * Smooth-scroll the cue list to the warm/next cue.
 */
function jumpToCurrent() {
  const target = findCurrentCard();
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ── Department filters ─────────────────────

/**
 * Render department filter chips in the sidebar.
 */
function renderDeptFilters() {
  let html = `<span class="dept-chip ${activeDeptFilters.size === 0 ? 'active' : ''}" onclick="clearDeptFilters()">${t('sidebar.allDepts')}</span>`;
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

