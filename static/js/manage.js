/* ══════════════════════════════════════════
   manage.js — Manage view: departments, cues, acts, show name
   ══════════════════════════════════════════
   Sections:
     Data loading    — loadDepartments, loadCues, loadActs, loadShowName
     Dept panel      — renderDeptList, openDeptModal, saveDept, deleteDept
     Cue table       — renderCueTable, sortCueTable, openCueModal, saveCue, deleteCue
     Act panel       — renderActList, openActModal, saveAct, deleteAct
     Show name       — saveShowName
   Dependencies: state.js, api.js (apiSave, apiDelete, showToast, closeModal)
   ══════════════════════════════════════════ */

// ── Data loading ───────────────────────────

/**
 * Refresh all Manage view data: departments, cues, and both renders.
 */
async function refreshManageView() {
  await Promise.all([loadDepartments(), loadCues(), loadActs()]);
  renderDeptList();
  renderCueList();
  renderDeptFilters();
  renderActList();
}

/**
 * Load departments from the API into the global state.
 */
async function loadDepartments() {
  departments = await api('/departments');
}

/**
 * Load cues from the API into the global state.
 */
async function loadCues() {
  cues = await api('/cues');
}

/** Load acts from the API into the global state. */
async function loadActs() {
  acts = await api('/acts');
}

/** Load and display the show name from the API. */
async function loadShowName() {
  const res = await api('/show/name');
  showName = res.name || '';
  if (DOM.showNameLabel) DOM.showNameLabel.textContent = showName || 'ShowPulse';
  const input = document.getElementById('show-name-input');
  if (input) input.value = showName;
}

// ── DeptPanel ──────────────────────────────

/**
 * Render the department list in the Manage view.
 */
function renderDeptList() {
  if (departments.length === 0) {
    DOM.deptList.innerHTML = '<div class="panel-body--padded" style="color:var(--text-dim);font-size:0.85rem">No departments yet.</div>';
    return;
  }
  DOM.deptList.innerHTML = departments.map(d => `
    <div class="dept-item">
      <div class="dept-color" style="background:${d.color}"></div>
      <div class="dept-name">${esc(d.name)}</div>
      <div class="dept-actions">
        <button class="icon-btn" onclick="openDeptModal('${d.id}')" title="Edit">&#9998;</button>
        <button class="icon-btn danger" onclick="deleteDept('${d.id}')" title="Delete">&times;</button>
      </div>
    </div>
  `).join('');
}

// ── Cue List (act-grouped) ─────────────────

/** Set of act IDs collapsed in the editor cue list. */
const cueListCollapsed = new Set();

/** Set of selected cue IDs for bulk operations. */
const selectedCues = new Set();

/** Last clicked cue ID for shift-range selection. */
let lastSelectedCueId = null;

/**
 * Render the cue list grouped by act with collapsible headers.
 */
function renderCueList() {
  // Populate department filter dropdown
  const curFilter = DOM.manageDeptFilter.value;
  DOM.manageDeptFilter.innerHTML = '<option value="">All Departments</option>' +
    departments.map(d => `<option value="${d.id}"${d.id === curFilter ? ' selected' : ''}>${esc(d.name)}</option>`).join('');

  // Filter
  let filtered = cues;
  if (curFilter) {
    filtered = cues.filter(c => c.department_id === curFilter);
  }

  // Sort by timecode
  filtered = [...filtered].sort((a, b) => tcObjToSeconds(a.trigger_tc) - tcObjToSeconds(b.trigger_tc));

  if (filtered.length === 0) {
    DOM.cueListBody.innerHTML = '<div class="cue-list-empty">No cues yet.</div>';
    renderTimeline();
    return;
  }

  // Group by act
  const actGroups = new Map();
  const ungrouped = [];
  for (const c of filtered) {
    if (c.act_id) {
      if (!actGroups.has(c.act_id)) actGroups.set(c.act_id, []);
      actGroups.get(c.act_id).push(c);
    } else {
      ungrouped.push(c);
    }
  }

  // Sort act groups by act sort_order
  const sortedActs = acts.slice().sort((a, b) => a.sort_order - b.sort_order);

  let html = '';

  for (const act of sortedActs) {
    const actCues = actGroups.get(act.id);
    if (!actCues || actCues.length === 0) continue;

    const span = cueListActSpan(actCues);
    const collapsed = cueListCollapsed.has(act.id) ? ' collapsed' : '';

    html += `<div class="cue-act-group${collapsed}" data-act-id="${act.id}">`;
    html += `<div class="cue-act-header" onclick="toggleCueActGroup('${act.id}')">
      <label class="cue-act-check" onclick="event.stopPropagation()"><input type="checkbox" onclick="selectAllInAct('${act.id}', this.checked)"></label>
      <span class="cue-act-chevron">&#x25BE;</span>
      <span class="cue-act-title">${esc(act.name)}</span>
      <span class="cue-act-meta">${actCues.length} cue${actCues.length !== 1 ? 's' : ''}${span ? ' \u00b7 ' + span : ''}</span>
      <button class="cue-act-add" onclick="event.stopPropagation(); addCueToAct('${act.id}')" title="Add cue to this act">+</button>
    </div>`;

    for (const c of actCues) {
      html += renderCueItem(c);
    }

    html += '</div>';
  }

  // Ungrouped cues
  if (ungrouped.length > 0) {
    if (actGroups.size > 0) {
      html += '<div class="cue-act-group">';
      html += `<div class="cue-act-header cue-act-header--dim">
        <span class="cue-act-title">Ungrouped</span>
        <span class="cue-act-meta">${ungrouped.length} cue${ungrouped.length !== 1 ? 's' : ''}</span>
      </div>`;
    }
    for (const c of ungrouped) {
      html += renderCueItem(c);
    }
    if (actGroups.size > 0) html += '</div>';
  }

  DOM.cueListBody.innerHTML = html;
  updateBulkBar();
  renderTimeline();
}

/**
 * Render a single cue item row.
 * @param {Object} c - Cue object.
 * @returns {string} HTML string.
 */
function renderCueItem(c) {
  const dept = departments.find(d => d.id === c.department_id);
  const deptColor = dept ? dept.color : CONST.DEFAULT_DEPT_COLOR;
  const deptName = dept ? esc(dept.name) : '?';
  const sel = selectedCues.has(c.id);

  return `<div class="cue-item${sel ? ' selected' : ''}" data-cue-id="${c.id}">
    <label class="cue-check" onclick="event.stopPropagation()"><input type="checkbox" onclick="handleCueCheck('${c.id}', this.checked, event)"${sel ? ' checked' : ''}></label>
    <span class="cue-grip" title="Drag to reorder">&#x283F;</span>
    <span class="cue-bar" style="background:${deptColor}"></span>
    <span class="cue-tc" data-field="tc">${fmtTC(c.trigger_tc)}</span>
    <span class="cue-label" data-field="label">${esc(c.label)}</span>
    <span class="cue-dept" data-field="dept"><span class="cue-dot" style="background:${deptColor}"></span>${deptName}</span>
    <span class="cue-warn" data-field="warn">${c.warn_seconds}s</span>
    <span class="cue-actions">
      <button class="icon-btn" onclick="duplicateCue('${c.id}')" title="Duplicate">&#x2295;</button>
      <button class="icon-btn" onclick="openCueModal('${c.id}')" title="Edit">&#9998;</button>
      <button class="icon-btn danger" onclick="deleteCue('${c.id}')" title="Delete">&times;</button>
    </span>
  </div>`;
}

/**
 * Toggle collapse state of an act group in the cue list.
 * @param {string} actId - Act UUID.
 */
function toggleCueActGroup(actId) {
  const group = DOM.cueListBody.querySelector(`.cue-act-group[data-act-id="${actId}"]`);
  if (!group) return;
  if (cueListCollapsed.has(actId)) {
    cueListCollapsed.delete(actId);
    group.classList.remove('collapsed');
  } else {
    cueListCollapsed.add(actId);
    group.classList.add('collapsed');
  }
}

/**
 * Compute the time span of an act's cues (first TC to last TC).
 * @param {Array<Object>} actCues - Array of cues in one act.
 * @returns {string} Formatted duration or empty string.
 */
function cueListActSpan(actCues) {
  if (actCues.length < 2) return '';
  const times = actCues.map(c => tcObjToSeconds(c.trigger_tc)).sort((a, b) => a - b);
  const span = times[times.length - 1] - times[0];
  if (span <= 0) return '';
  const m = Math.floor(span / 60);
  const s = Math.floor(span % 60);
  return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
}

// ── Timeline Strip ──────────────────────────

/**
 * Render the visual timeline strip above the cue list.
 * Shows act regions, cue markers, and a playhead.
 */
function renderTimeline() {
  const strip = DOM.timelineStrip;
  if (!strip) return;
  if (cues.length === 0) { strip.innerHTML = ''; return; }

  const times = cues.map(c => tcObjToSeconds(c.trigger_tc)).sort((a, b) => a - b);
  const pad = Math.max(10, (times[times.length - 1] - times[0]) * 0.03);
  const minT = Math.max(0, times[0] - pad);
  const maxT = times[times.length - 1] + pad;
  const range = maxT - minT || 1;
  const pct = (sec) => ((sec - minT) / range * 100).toFixed(2);

  // Act bands
  let bands = '';
  const sortedActs = acts.slice().sort((a, b) => a.sort_order - b.sort_order);
  for (const act of sortedActs) {
    const ac = cues.filter(c => c.act_id === act.id);
    if (ac.length === 0) continue;
    const at = ac.map(c => tcObjToSeconds(c.trigger_tc));
    const l = pct(Math.min(...at));
    const w = ((Math.max(...at) - Math.min(...at)) / range * 100).toFixed(2);
    bands += `<div class="tl-act" style="left:${l}%;width:${Math.max(parseFloat(w), 0.5)}%" title="${esc(act.name)}"></div>`;
  }

  // Cue markers
  let markers = '';
  for (const c of cues) {
    const color = getDeptColor(c.department_id);
    markers += `<div class="tl-cue" style="left:${pct(tcObjToSeconds(c.trigger_tc))}%;background:${color}" title="${esc(c.label)}" onclick="scrollToCueItem('${c.id}')"></div>`;
  }

  // Time labels
  let labels = '';
  const n = 5;
  for (let i = 0; i <= n; i++) {
    const sec = minT + range * i / n;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const txt = h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
    labels += `<span style="left:${(i / n * 100).toFixed(1)}%">${txt}</span>`;
  }

  strip.innerHTML = `<div class="tl-track">${bands}${markers}<div class="tl-playhead" id="tl-playhead"></div></div><div class="tl-labels">${labels}</div>`;
  strip.dataset.minT = minT;
  strip.dataset.range = range;
}

/** Update the playhead position from the current timecode display. */
function updateTimelinePlayhead() {
  const ph = document.getElementById('tl-playhead');
  const strip = DOM.timelineStrip;
  if (!ph || !strip || !strip.dataset.range) return;
  const curSec = tcToSeconds(DOM.tcValue ? DOM.tcValue.textContent : '00:00:00:00');
  const minT = parseFloat(strip.dataset.minT) || 0;
  const range = parseFloat(strip.dataset.range) || 1;
  ph.style.left = Math.max(0, Math.min(100, (curSec - minT) / range * 100)) + '%';
}

/** Scroll to a cue item in the list and briefly highlight it. */
function scrollToCueItem(cueId) {
  const item = DOM.cueListBody.querySelector(`.cue-item[data-cue-id="${cueId}"]`);
  if (!item) return;
  // Expand act group if collapsed
  const group = item.closest('.cue-act-group');
  if (group && group.classList.contains('collapsed')) {
    const actId = group.dataset.actId;
    if (actId) toggleCueActGroup(actId);
  }
  item.scrollIntoView({ behavior: 'smooth', block: 'center' });
  item.classList.add('cue-highlight');
  setTimeout(() => item.classList.remove('cue-highlight'), 1500);
}

// ── Drag & Drop ─────────────────────────────

/** Currently dragged cue ID. */
let dragCueId = null;

/**
 * Initialize drag-and-drop on the cue list via event delegation.
 * Call once after initDOM().
 */
function initCueDrag() {
  const el = DOM.cueListBody;
  if (!el) return;

  // Only allow drag when initiated from grip handle
  el.addEventListener('mousedown', (e) => {
    const grip = e.target.closest('.cue-grip');
    if (!grip) return;
    const item = grip.closest('.cue-item');
    if (item) item.draggable = true;
  });

  el.addEventListener('dragstart', (e) => {
    const item = e.target.closest('.cue-item');
    if (!item) return;
    dragCueId = item.dataset.cueId;
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragCueId);
  });

  el.addEventListener('dragover', (e) => {
    if (!dragCueId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Clear previous indicators
    el.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(
      n => n.classList.remove('drag-over-top', 'drag-over-bottom')
    );
    el.querySelectorAll('.cue-act-header.drag-over').forEach(
      n => n.classList.remove('drag-over')
    );

    // Indicator on cue item
    const item = e.target.closest('.cue-item');
    if (item && item.dataset.cueId !== dragCueId) {
      const rect = item.getBoundingClientRect();
      item.classList.add(e.clientY < rect.top + rect.height / 2 ? 'drag-over-top' : 'drag-over-bottom');
      return;
    }

    // Indicator on act header (drop to move into act)
    const header = e.target.closest('.cue-act-header');
    if (header) header.classList.add('drag-over');
  });

  el.addEventListener('drop', async (e) => {
    e.preventDefault();
    if (!dragCueId) return;

    // Drop on a cue item
    const targetItem = e.target.closest('.cue-item');
    if (targetItem && targetItem.dataset.cueId !== dragCueId) {
      const rect = targetItem.getBoundingClientRect();
      const dropAbove = e.clientY < rect.top + rect.height / 2;
      cleanupDrag();
      await handleCueDrop(dragCueId, targetItem.dataset.cueId, dropAbove);
      dragCueId = null;
      return;
    }

    // Drop on act header
    const header = e.target.closest('.cue-act-header');
    if (header) {
      const actId = header.closest('.cue-act-group')?.dataset.actId;
      if (actId) {
        cleanupDrag();
        await handleCueDropToAct(dragCueId, actId);
        dragCueId = null;
        return;
      }
    }

    cleanupDrag();
    dragCueId = null;
  });

  el.addEventListener('dragend', () => {
    cleanupDrag();
    dragCueId = null;
  });
}

/** Clear all drag visual states. */
function cleanupDrag() {
  const el = DOM.cueListBody;
  el.querySelectorAll('.dragging').forEach(n => n.classList.remove('dragging'));
  el.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(
    n => n.classList.remove('drag-over-top', 'drag-over-bottom')
  );
  el.querySelectorAll('.cue-act-header.drag-over').forEach(
    n => n.classList.remove('drag-over')
  );
  el.querySelectorAll('[draggable]').forEach(n => n.draggable = false);
}

/**
 * Handle dropping a cue onto/between another cue.
 * Calculates a new timecode to position it correctly.
 */
async function handleCueDrop(draggedId, targetId, dropAbove) {
  const draggedCue = cues.find(c => c.id === draggedId);
  const targetCue = cues.find(c => c.id === targetId);
  if (!draggedCue || !targetCue) return;

  const targetActId = targetCue.act_id || null;
  const siblings = cues
    .filter(c => (c.act_id || null) === targetActId && c.id !== draggedId)
    .sort((a, b) => tcObjToSeconds(a.trigger_tc) - tcObjToSeconds(b.trigger_tc));

  const targetIdx = siblings.findIndex(c => c.id === targetId);
  const newTcSec = calcDropTc(siblings, targetIdx, dropAbove);

  await saveCueDrop(draggedCue, {
    trigger_tc: secondsToTcObj(newTcSec),
    act_id: targetActId,
  });
}

/**
 * Handle dropping a cue onto an act header (move to end of that act).
 */
async function handleCueDropToAct(draggedId, actId) {
  const draggedCue = cues.find(c => c.id === draggedId);
  if (!draggedCue) return;

  const actCues = cues
    .filter(c => c.act_id === actId && c.id !== draggedId)
    .sort((a, b) => tcObjToSeconds(a.trigger_tc) - tcObjToSeconds(b.trigger_tc));

  const newTcSec = actCues.length === 0
    ? tcObjToSeconds(draggedCue.trigger_tc)
    : tcObjToSeconds(actCues[actCues.length - 1].trigger_tc) + 5;

  await saveCueDrop(draggedCue, {
    trigger_tc: secondsToTcObj(newTcSec),
    act_id: actId,
  });
}

/**
 * Calculate new timecode (in seconds) for a dropped cue based on neighbors.
 */
function calcDropTc(siblings, targetIdx, dropAbove) {
  if (siblings.length === 0) return 0;
  if (dropAbove) {
    if (targetIdx === 0) return Math.max(0, tcObjToSeconds(siblings[0].trigger_tc) - 5);
    const prev = tcObjToSeconds(siblings[targetIdx - 1].trigger_tc);
    const curr = tcObjToSeconds(siblings[targetIdx].trigger_tc);
    return (prev + curr) / 2;
  } else {
    if (targetIdx >= siblings.length - 1) return tcObjToSeconds(siblings[siblings.length - 1].trigger_tc) + 5;
    const curr = tcObjToSeconds(siblings[targetIdx].trigger_tc);
    const next = tcObjToSeconds(siblings[targetIdx + 1].trigger_tc);
    return (curr + next) / 2;
  }
}

/**
 * Save a cue after drag-drop reorder.
 */
async function saveCueDrop(cue, updates) {
  const body = { ...cue, ...updates };
  try {
    await api(`/cues/${cue.id}`, { method: 'PUT', body });
    await refreshManageView();
    showToast('Cue moved', 'success');
  } catch (e) {
    showToast('Failed to move cue', 'error');
  }
}

// ── Inline Edit ─────────────────────────────

/**
 * Initialize inline editing on the cue list via event delegation.
 * Double-click a field to edit it in place. Enter saves, Escape cancels.
 */
function initCueInlineEdit() {
  const el = DOM.cueListBody;
  if (!el) return;

  el.addEventListener('dblclick', (e) => {
    if (e.target.closest('button, input, select')) return;
    const item = e.target.closest('.cue-item');
    if (!item) return;
    const field = e.target.closest('[data-field]');
    if (!field) return;
    startInlineEdit(item, item.dataset.cueId, field);
  });
}

/**
 * Replace a field's content with an inline editor.
 */
function startInlineEdit(item, cueId, fieldEl) {
  const fieldName = fieldEl.dataset.field;
  const cue = cues.find(c => c.id === cueId);
  if (!cue || fieldEl.querySelector('input, select')) return;

  let input;
  switch (fieldName) {
    case 'label':
      input = document.createElement('input');
      input.type = 'text';
      input.value = cue.label;
      input.className = 'inline-edit';
      break;
    case 'tc':
      input = document.createElement('input');
      input.type = 'text';
      input.value = fmtTC(cue.trigger_tc);
      input.className = 'inline-edit inline-edit--tc';
      input.placeholder = 'HH:MM:SS:FF';
      break;
    case 'dept':
      input = document.createElement('select');
      input.className = 'inline-edit';
      input.innerHTML = departments.map(d =>
        `<option value="${d.id}"${d.id === cue.department_id ? ' selected' : ''}>${esc(d.name)}</option>`
      ).join('');
      break;
    case 'warn':
      input = document.createElement('input');
      input.type = 'number';
      input.value = cue.warn_seconds;
      input.min = 0;
      input.max = 999;
      input.className = 'inline-edit inline-edit--sm';
      break;
    default: return;
  }

  const originalHTML = fieldEl.innerHTML;
  fieldEl.innerHTML = '';
  fieldEl.appendChild(input);
  input.focus();
  if (input.select) input.select();

  const finish = async (save) => {
    if (input._done) return;
    input._done = true;
    if (!save) { fieldEl.innerHTML = originalHTML; return; }

    const updates = {};
    switch (fieldName) {
      case 'label': updates.label = input.value || 'Untitled Cue'; break;
      case 'tc': updates.trigger_tc = parseTC(input.value); break;
      case 'dept': updates.department_id = input.value; break;
      case 'warn': updates.warn_seconds = parseInt(input.value) || CONST.DEFAULT_WARN_SEC; break;
    }
    try {
      await api(`/cues/${cue.id}`, { method: 'PUT', body: { ...cue, ...updates } });
      await refreshManageView();
    } catch (e) {
      showToast('Failed to update cue', 'error');
      fieldEl.innerHTML = originalHTML;
    }
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
  if (input.tagName === 'SELECT') input.addEventListener('change', () => finish(true));
}

// ── Multi-Select & Bulk Ops ─────────────────

/**
 * Create the floating bulk action bar (appended to body).
 * Call once at init.
 */
function initCueBulkOps() {
  const bar = document.createElement('div');
  bar.className = 'bulk-bar';
  bar.id = 'bulk-bar';
  bar.innerHTML = `
    <span class="bulk-count" id="bulk-count"></span>
    <div class="bulk-actions">
      <select class="bulk-select" id="bulk-move-act" onchange="bulkMoveToAct(this.value); this.value='';">
        <option value="">Move to...</option>
      </select>
      <button class="bulk-btn" onclick="bulkDuplicate()">Duplicate</button>
      <button class="bulk-btn" onclick="bulkArm(true)">Arm</button>
      <button class="bulk-btn" onclick="bulkArm(false)">Disarm</button>
      <button class="bulk-btn bulk-btn--danger" onclick="bulkDelete()">Delete</button>
    </div>
    <button class="bulk-close" onclick="clearSelection()" title="Clear selection">&times;</button>
  `;
  document.body.appendChild(bar);
}

/**
 * Handle checkbox click on a cue item. Supports shift-range select.
 */
function handleCueCheck(cueId, checked, event) {
  if (event.shiftKey && lastSelectedCueId) {
    const items = [...DOM.cueListBody.querySelectorAll('.cue-item')];
    const startIdx = items.findIndex(el => el.dataset.cueId === lastSelectedCueId);
    const endIdx = items.findIndex(el => el.dataset.cueId === cueId);
    if (startIdx >= 0 && endIdx >= 0) {
      const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
      for (let i = from; i <= to; i++) {
        selectedCues.add(items[i].dataset.cueId);
        items[i].classList.add('selected');
        const cb = items[i].querySelector('.cue-check input');
        if (cb) cb.checked = true;
      }
    }
  } else if (checked) {
    selectedCues.add(cueId);
    const item = DOM.cueListBody.querySelector(`.cue-item[data-cue-id="${cueId}"]`);
    if (item) item.classList.add('selected');
  } else {
    selectedCues.delete(cueId);
    const item = DOM.cueListBody.querySelector(`.cue-item[data-cue-id="${cueId}"]`);
    if (item) item.classList.remove('selected');
  }
  lastSelectedCueId = cueId;
  updateBulkBar();
}

/**
 * Select or deselect all cues in an act group.
 */
function selectAllInAct(actId, checked) {
  const actCueIds = cues.filter(c => c.act_id === actId).map(c => c.id);
  const group = DOM.cueListBody.querySelector(`.cue-act-group[data-act-id="${actId}"]`);
  if (!group) return;
  actCueIds.forEach(id => checked ? selectedCues.add(id) : selectedCues.delete(id));
  group.querySelectorAll('.cue-item').forEach(item => {
    item.classList.toggle('selected', checked);
    const cb = item.querySelector('.cue-check input');
    if (cb) cb.checked = checked;
  });
  updateBulkBar();
}

/** Show/hide and update the bulk action bar. */
function updateBulkBar() {
  const bar = document.getElementById('bulk-bar');
  if (!bar) return;
  // Prune stale selections
  const ids = new Set(cues.map(c => c.id));
  for (const id of selectedCues) { if (!ids.has(id)) selectedCues.delete(id); }

  if (selectedCues.size === 0) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  document.getElementById('bulk-count').textContent =
    `${selectedCues.size} cue${selectedCues.size !== 1 ? 's' : ''} selected`;
  const sel = document.getElementById('bulk-move-act');
  sel.innerHTML = '<option value="">Move to...</option>' +
    acts.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('') +
    '<option value="__none__">Ungrouped</option>';
}

/** Clear all selections. */
function clearSelection() {
  selectedCues.clear();
  lastSelectedCueId = null;
  DOM.cueListBody.querySelectorAll('.cue-item.selected').forEach(el => el.classList.remove('selected'));
  DOM.cueListBody.querySelectorAll('.cue-check input, .cue-act-check input').forEach(cb => cb.checked = false);
  updateBulkBar();
}

/** Bulk move selected cues to an act. */
async function bulkMoveToAct(actId) {
  if (!actId || selectedCues.size === 0) return;
  const target = actId === '__none__' ? null : actId;
  try {
    await Promise.all([...selectedCues].map(id => {
      const c = cues.find(c => c.id === id);
      return c ? api(`/cues/${id}`, { method: 'PUT', body: { ...c, act_id: target } }) : null;
    }));
    showToast(`Moved ${selectedCues.size} cues`, 'success');
    clearSelection();
    await refreshManageView();
  } catch (e) { showToast('Failed to move cues', 'error'); }
}

/** Bulk duplicate selected cues. */
async function bulkDuplicate() {
  if (selectedCues.size === 0) return;
  try {
    await Promise.all([...selectedCues].map(id => {
      const c = cues.find(c => c.id === id);
      if (!c) return null;
      return api('/cues', { method: 'POST', body: {
        ...c, id: CONST.NULL_UUID, label: c.label + ' (copy)',
        trigger_tc: secondsToTcObj(tcObjToSeconds(c.trigger_tc) + 5), cue_number: '',
      }});
    }));
    showToast(`Duplicated ${selectedCues.size} cues`, 'success');
    clearSelection();
    await refreshManageView();
  } catch (e) { showToast('Failed to duplicate cues', 'error'); }
}

/** Bulk delete selected cues. */
async function bulkDelete() {
  if (selectedCues.size === 0) return;
  const ok = await showConfirm('Delete Cues', `Delete ${selectedCues.size} selected cue${selectedCues.size !== 1 ? 's' : ''}?`);
  if (!ok) return;
  try {
    await Promise.all([...selectedCues].map(id => api(`/cues/${id}`, { method: 'DELETE' })));
    showToast(`Deleted ${selectedCues.size} cues`, 'success');
    clearSelection();
    await refreshManageView();
  } catch (e) { showToast('Failed to delete cues', 'error'); }
}

/** Bulk arm or disarm selected cues. */
async function bulkArm(armed) {
  if (selectedCues.size === 0) return;
  try {
    await Promise.all([...selectedCues].map(id => {
      const c = cues.find(c => c.id === id);
      return c ? api(`/cues/${id}`, { method: 'PUT', body: { ...c, armed } }) : null;
    }));
    showToast(`${armed ? 'Armed' : 'Disarmed'} ${selectedCues.size} cues`, 'success');
    clearSelection();
    await refreshManageView();
  } catch (e) { showToast(`Failed to ${armed ? 'arm' : 'disarm'} cues`, 'error'); }
}

// ── Department CRUD ────────────────────────

/**
 * Open the department modal for create or edit.
 * @param {string} [editId] - Department ID to edit, or omit for create.
 */
function openDeptModal(editId) {
  const modal = document.getElementById('dept-modal');
  document.getElementById('dept-edit-id').value = editId || '';
  if (editId) {
    const d = departments.find(d => d.id === editId);
    document.getElementById('dept-modal-title').textContent = 'Edit Department';
    document.getElementById('dept-name').value = d.name;
    document.getElementById('dept-color').value = d.color;
    document.getElementById('dept-color-text').value = d.color;
  } else {
    document.getElementById('dept-modal-title').textContent = 'Add Department';
    document.getElementById('dept-name').value = '';
    document.getElementById('dept-color').value = CONST.DEFAULT_NEW_DEPT_COLOR;
    document.getElementById('dept-color-text').value = CONST.DEFAULT_NEW_DEPT_COLOR;
  }
  modal.classList.add('open');
  document.getElementById('dept-name').focus();
}

/**
 * Save a department (create or update) from the modal form.
 */
async function saveDept() {
  const id = document.getElementById('dept-edit-id').value;
  const body = {
    id: id || CONST.NULL_UUID,
    name: document.getElementById('dept-name').value,
    color: document.getElementById('dept-color').value,
  };
  if (await apiSave('/departments', id, body, 'Department')) closeModal('dept-modal');
  refreshManageView();
}

/**
 * Delete a department after confirmation.
 * @param {string} id - Department UUID.
 */
async function deleteDept(id) {
  if (await apiDelete(`/departments/${id}`, 'Delete Department', 'Delete this department and all its cues?', 'Department')) {
    refreshManageView();
  }
}

// ── Cue CRUD ───────────────────────────────

/**
 * Open the cue modal for create or edit.
 * @param {string} [editId] - Cue ID to edit, or omit for create.
 */
function openCueModal(editId) {
  const modal = document.getElementById('cue-modal');
  const sel = document.getElementById('cue-dept');
  sel.innerHTML = departments.map(d =>
    `<option value="${d.id}">${esc(d.name)}</option>`
  ).join('');

  const actSel = document.getElementById('cue-act');
  actSel.innerHTML = '<option value="">— No Act —</option>' +
    acts.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('');

  const isEdit = !!editId;
  document.getElementById('cue-edit-id').value = editId || '';
  document.getElementById('cue-modal-title').textContent = isEdit ? 'Edit Cue' : 'Add Cue';

  // "Save & Add Another" only in create mode
  const anotherBtn = document.getElementById('cue-save-another-btn');
  if (anotherBtn) anotherBtn.style.display = isEdit ? 'none' : '';

  updateCueDeptDot();

  if (isEdit) {
    const c = cues.find(c => c.id === editId);
    document.getElementById('cue-label').value = c.label;
    sel.value = c.department_id;
    updateCueDeptDot();
    actSel.value = c.act_id || '';
    setCueTC(c.trigger_tc);
    document.getElementById('cue-warn').value = c.warn_seconds;
    // Advanced fields
    document.getElementById('cue-number').value = c.cue_number || '';
    document.getElementById('cue-duration').value = c.duration != null ? c.duration : '';
    document.getElementById('cue-armed').checked = c.armed !== false;
    document.getElementById('cue-armed-label').textContent = c.armed !== false ? 'Yes' : 'No';
    document.getElementById('cue-continue').value = c.continue_mode || 'stop';
    document.getElementById('cue-postwait').value = c.post_wait || 0;
    document.getElementById('cue-notes').value = c.notes || '';
    togglePostWait();
    // Open advanced if any non-default values
    const adv = document.getElementById('cue-advanced');
    const hasAdvanced = c.cue_number || c.duration != null || c.armed === false
      || (c.continue_mode && c.continue_mode !== 'stop') || c.notes;
    adv.open = !!hasAdvanced;
  } else {
    resetCueForm();
  }
  modal.classList.add('open');
  document.getElementById('cue-label').focus();
}

/** Reset cue form to defaults for new cue creation. */
function resetCueForm() {
  document.getElementById('cue-edit-id').value = '';
  document.getElementById('cue-label').value = '';
  document.getElementById('cue-number').value = '';
  document.getElementById('cue-warn').value = String(CONST.DEFAULT_WARN_SEC);
  document.getElementById('cue-duration').value = '';
  document.getElementById('cue-armed').checked = true;
  document.getElementById('cue-armed-label').textContent = 'Yes';
  document.getElementById('cue-continue').value = 'stop';
  document.getElementById('cue-postwait').value = '0';
  document.getElementById('cue-notes').value = '';
  document.getElementById('cue-advanced').open = false;
  togglePostWait();

  // Smart defaults: remember last department + act
  const lastDept = localStorage.getItem('cue-last-dept');
  const lastAct = localStorage.getItem('cue-last-act');
  const sel = document.getElementById('cue-dept');
  const actSel = document.getElementById('cue-act');
  if (lastDept && [...sel.options].some(o => o.value === lastDept)) sel.value = lastDept;
  if (lastAct && [...actSel.options].some(o => o.value === lastAct)) actSel.value = lastAct;
  updateCueDeptDot();

  // Smart TC: use current timecode if running, else 00:00:00:00
  const curTC = DOM.tcValue ? DOM.tcValue.textContent : null;
  const tcState = DOM.tcState ? DOM.tcState.textContent : '';
  if (curTC && curTC !== CONST.DEFAULT_TC && tcState === 'RUNNING') {
    setCueTC(parseTC(curTC));
  } else {
    setCueTC({ hours: 0, minutes: 0, seconds: 0, frames: 0 });
  }
}

/** Set TC fields from a timecode object. */
function setCueTC(tc) {
  document.getElementById('cue-tc-hh').value = tc.hours || 0;
  document.getElementById('cue-tc-mm').value = tc.minutes || 0;
  document.getElementById('cue-tc-ss').value = tc.seconds || 0;
  document.getElementById('cue-tc-ff').value = tc.frames || 0;
}

/** Read TC fields into a timecode object. */
function getCueTC() {
  return {
    hours: parseInt(document.getElementById('cue-tc-hh').value) || 0,
    minutes: parseInt(document.getElementById('cue-tc-mm').value) || 0,
    seconds: parseInt(document.getElementById('cue-tc-ss').value) || 0,
    frames: parseInt(document.getElementById('cue-tc-ff').value) || 0,
  };
}

/** Update the department color dot next to the select. */
function updateCueDeptDot() {
  const sel = document.getElementById('cue-dept');
  const dot = document.getElementById('cue-dept-dot');
  if (!dot || !sel.value) return;
  const dept = departments.find(d => d.id === sel.value);
  dot.style.background = dept ? dept.color : 'var(--text-dim)';
}

/** Show/hide post-wait field based on continue mode. */
function togglePostWait() {
  const mode = document.getElementById('cue-continue').value;
  const group = document.getElementById('cue-postwait-group');
  if (group) group.style.display = mode === 'auto_continue' ? '' : 'none';
}

/**
 * Save a cue (create or update) from the modal form.
 * @param {boolean} [addAnother] - If true, reset form for another cue instead of closing.
 */
async function saveCue(addAnother) {
  const id = document.getElementById('cue-edit-id').value;
  const deptVal = document.getElementById('cue-dept').value;
  const actVal = document.getElementById('cue-act').value;
  const durVal = document.getElementById('cue-duration').value;
  const contMode = document.getElementById('cue-continue').value;

  const body = {
    id: id || CONST.NULL_UUID,
    department_id: deptVal,
    cue_number: document.getElementById('cue-number').value,
    label: document.getElementById('cue-label').value || 'Untitled Cue',
    trigger_tc: getCueTC(),
    warn_seconds: parseInt(document.getElementById('cue-warn').value) || CONST.DEFAULT_WARN_SEC,
    notes: document.getElementById('cue-notes').value,
    act_id: actVal || null,
    duration: durVal !== '' ? parseInt(durVal) : null,
    armed: document.getElementById('cue-armed').checked,
    continue_mode: contMode,
    post_wait: contMode === 'auto_continue' ? (parseFloat(document.getElementById('cue-postwait').value) || 0) : null,
  };

  if (await apiSave('/cues', id, body, 'Cue')) {
    // Remember last-used dept + act for next cue
    localStorage.setItem('cue-last-dept', deptVal);
    if (actVal) localStorage.setItem('cue-last-act', actVal);

    if (addAnother && !id) {
      // Reset for another cue, keep dept + act
      await refreshManageView();
      resetCueForm();
      document.getElementById('cue-modal-title').textContent = 'Add Cue';
      document.getElementById('cue-label').focus();
    } else {
      closeModal('cue-modal');
      refreshManageView();
    }
  }
}

/**
 * Delete a cue after confirmation.
 * @param {string} id - Cue UUID.
 */
async function deleteCue(id) {
  if (await apiDelete(`/cues/${id}`, 'Delete Cue', 'Delete this cue?', 'Cue')) {
    refreshManageView();
  }
}

/**
 * Duplicate a cue with TC offset +5 seconds.
 * @param {string} id - Cue UUID to duplicate.
 */
async function duplicateCue(id) {
  const cue = cues.find(c => c.id === id);
  if (!cue) return;
  const body = {
    ...cue,
    id: CONST.NULL_UUID,
    label: cue.label + ' (copy)',
    trigger_tc: secondsToTcObj(tcObjToSeconds(cue.trigger_tc) + 5),
    cue_number: '',
  };
  try {
    await api('/cues', { method: 'POST', body });
    await refreshManageView();
    showToast('Cue duplicated', 'success');
  } catch (e) {
    showToast('Failed to duplicate cue', 'error');
  }
}

/**
 * Open the cue modal pre-set to a specific act.
 * @param {string} actId - Act UUID to pre-select.
 */
function addCueToAct(actId) {
  localStorage.setItem('cue-last-act', actId);
  openCueModal();
}

// ── Act CRUD ────────────────────────────────

/** Render the act list in the Manage view sidebar. */
function renderActList() {
  if (!DOM.actList) return;
  const el = DOM.actList;
  if (acts.length === 0) {
    el.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem;padding:0.5rem">No acts yet.</div>';
    return;
  }
  el.innerHTML = acts.map(a => {
    const cueCount = cues.filter(c => c.act_id === a.id).length;
    return `<div class="dept-item">
      <div class="dept-name">${esc(a.name)} <span style="color:var(--text-dim);font-size:0.75rem">(${cueCount} cues)</span></div>
      <div class="dept-actions">
        <button class="icon-btn" onclick="duplicateAct('${a.id}')" title="Duplicate act">&#x2295;</button>
        <button class="icon-btn" onclick="openActModal('${a.id}')" title="Edit">&#9998;</button>
        <button class="icon-btn danger" onclick="deleteAct('${a.id}')" title="Delete">&times;</button>
      </div>
    </div>`;
  }).join('');
}

/**
 * Open the act modal for create or edit.
 * @param {string} [editId] - Act ID to edit, or omit for create.
 */
function openActModal(editId) {
  const modal = document.getElementById('act-modal');
  document.getElementById('act-edit-id').value = editId || '';
  if (editId) {
    const a = acts.find(a => a.id === editId);
    document.getElementById('act-modal-title').textContent = 'Edit Act';
    document.getElementById('act-name').value = a.name;
    document.getElementById('act-sort-order').value = a.sort_order;
  } else {
    document.getElementById('act-modal-title').textContent = 'Add Act';
    document.getElementById('act-name').value = '';
    document.getElementById('act-sort-order').value = acts.length + 1;
  }
  modal.classList.add('open');
  document.getElementById('act-name').focus();
}

/** Save an act (create or update) from the modal form. */
async function saveAct() {
  const id = document.getElementById('act-edit-id').value;
  const body = {
    id: id || CONST.NULL_UUID,
    name: document.getElementById('act-name').value,
    sort_order: parseInt(document.getElementById('act-sort-order').value) || 1,
  };
  if (await apiSave('/acts', id, body, 'Act')) closeModal('act-modal');
  refreshManageView();
}

/**
 * Delete an act after confirmation. Cues are unassigned, not deleted.
 * @param {string} id - Act UUID.
 */
async function deleteAct(id) {
  if (await apiDelete(`/acts/${id}`, 'Delete Act', 'Delete this act? Cues will be unassigned.', 'Act')) {
    refreshManageView();
  }
}

/**
 * Duplicate an entire act and all its cues with a time offset.
 * @param {string} actId - Act UUID to duplicate.
 */
async function duplicateAct(actId) {
  const act = acts.find(a => a.id === actId);
  if (!act) return;
  const offsetStr = prompt('Time offset for duplicated cues (seconds):', '0');
  if (offsetStr === null) return;
  const offsetSec = parseFloat(offsetStr) || 0;
  try {
    const newAct = await api('/acts', { method: 'POST', body: {
      id: CONST.NULL_UUID,
      name: act.name + ' (copy)',
      sort_order: act.sort_order + 1,
    }});
    const actCues = cues.filter(c => c.act_id === actId);
    if (newAct && newAct.id && actCues.length > 0) {
      await Promise.all(actCues.map(c => api('/cues', { method: 'POST', body: {
        ...c, id: CONST.NULL_UUID, act_id: newAct.id, cue_number: '',
        trigger_tc: secondsToTcObj(tcObjToSeconds(c.trigger_tc) + offsetSec),
      }})));
    }
    await refreshManageView();
    showToast(`Duplicated "${act.name}" with ${actCues.length} cues`, 'success');
  } catch (e) {
    showToast('Failed to duplicate act', 'error');
  }
}

/** Save the show name from the Settings view input. */
async function saveShowName() {
  const name = document.getElementById('show-name-input').value;
  try {
    await api('/show/name', { method: 'PUT', body: { name } });
    showName = name;
    if (DOM.showNameLabel) DOM.showNameLabel.textContent = name || 'ShowPulse';
    showToast('Show name updated', 'success');
  } catch (e) {
    showToast('Failed to update show name', 'error');
  }
}
