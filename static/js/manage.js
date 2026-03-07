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
  renderCueTable();
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

// ── CueTable ───────────────────────────────

/**
 * Render the cue table with current filter and sort settings.
 */
function renderCueTable() {
  // Populate department filter dropdown
  const curFilter = DOM.manageDeptFilter.value;
  DOM.manageDeptFilter.innerHTML = '<option value="">All Departments</option>' +
    departments.map(d => `<option value="${d.id}"${d.id === curFilter ? ' selected' : ''}>${esc(d.name)}</option>`).join('');

  // Filter
  let filtered = cues;
  if (curFilter) {
    filtered = cues.filter(c => c.department_id === curFilter);
  }

  // Sort
  const getDeptName = (c) => {
    const d = departments.find(d => d.id === c.department_id);
    return d ? d.name.toLowerCase() : '';
  };
  const sortFns = {
    cue_number: (a, b) => (a.cue_number || '').localeCompare(b.cue_number || '', undefined, { numeric: true }),
    trigger_tc: (a, b) => fmtTC(a.trigger_tc).localeCompare(fmtTC(b.trigger_tc)),
    label: (a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()),
    department: (a, b) => getDeptName(a).localeCompare(getDeptName(b)),
    warn_seconds: (a, b) => a.warn_seconds - b.warn_seconds,
  };
  const fn = sortFns[cueTableSort.key] || sortFns.trigger_tc;
  filtered = [...filtered].sort((a, b) => cueTableSort.asc ? fn(a, b) : fn(b, a));

  // Update sort indicators
  ['cue_number', 'trigger_tc', 'label', 'department', 'warn_seconds'].forEach(k => {
    const th = document.getElementById(`sort-${k}`);
    if (!th) return;
    const base = { cue_number: '#', trigger_tc: 'Timecode', label: 'Label', department: 'Department', warn_seconds: 'Lead Time' }[k];
    th.textContent = k === cueTableSort.key ? `${base} ${cueTableSort.asc ? '\u25B2' : '\u25BC'}` : base;
  });

  if (filtered.length === 0) {
    DOM.cueTableBody.innerHTML = '<tr><td colspan="6" style="padding:1.5rem;text-align:center;color:var(--text-dim)">No cues yet.</td></tr>';
    return;
  }
  DOM.cueTableBody.innerHTML = filtered.map(c => {
    const dept = departments.find(d => d.id === c.department_id);
    return `<tr>
      <td style="color:var(--text-dim);font-size:0.8rem">${esc(c.cue_number || '')}</td>
      <td class="tc-cell">${fmtTC(c.trigger_tc)}</td>
      <td>${esc(c.label)}</td>
      <td><div class="dept-cell"><span class="dot" style="background:${dept ? dept.color : CONST.DEFAULT_DEPT_COLOR}"></span>${dept ? esc(dept.name) : '?'}</div></td>
      <td>${c.warn_seconds}s</td>
      <td><div class="actions-cell">
        <button class="icon-btn" onclick="openCueModal('${c.id}')" title="Edit">&#9998;</button>
        <button class="icon-btn danger" onclick="deleteCue('${c.id}')" title="Delete">&times;</button>
      </div></td>
    </tr>`;
  }).join('');
}

/**
 * Change the cue table sort column and direction.
 * @param {string} key - Column key to sort by.
 */
function sortCueTable(key) {
  if (cueTableSort.key === key) {
    cueTableSort.asc = !cueTableSort.asc;
  } else {
    cueTableSort.key = key;
    cueTableSort.asc = true;
  }
  renderCueTable();
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
