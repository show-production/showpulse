/* ══════════════════════════════════════════
   manage.js — ManageView: CRUD operations, table rendering, dept list
   ══════════════════════════════════════════
   Handles department and cue management (create, edit, delete, sort, filter).
   Dependencies: state.js, api.js, ui-helpers.js (showToast, showConfirm, closeModal)
   Components: ManageView, DeptPanel, CuePanel, CueTable
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

async function loadActs() {
  acts = await api('/acts');
}

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
  try {
    if (id) {
      await api(`/departments/${id}`, { method: 'PUT', body });
    } else {
      await api('/departments', { method: 'POST', body });
    }
    closeModal('dept-modal');
    showToast(id ? 'Department updated' : 'Department created', 'success');
  } catch (e) {
    showToast(`Failed to save department: ${e.message}`, 'error');
  }
  refreshManageView();
}

/**
 * Delete a department after confirmation.
 * @param {string} id - Department UUID.
 */
async function deleteDept(id) {
  const ok = await showConfirm('Delete Department', 'Delete this department and all its cues?');
  if (!ok) return;
  try {
    await api(`/departments/${id}`, { method: 'DELETE' });
    showToast('Department deleted', 'success');
  } catch (e) {
    showToast('Failed to delete department', 'error');
  }
  refreshManageView();
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
  if (actSel) {
    actSel.innerHTML = '<option value="">— No Act —</option>' +
      acts.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('');
  }

  document.getElementById('cue-edit-id').value = editId || '';
  if (editId) {
    const c = cues.find(c => c.id === editId);
    document.getElementById('cue-modal-title').textContent = 'Edit Cue';
    document.getElementById('cue-number').value = c.cue_number || '';
    document.getElementById('cue-label').value = c.label;
    sel.value = c.department_id;
    if (actSel) actSel.value = c.act_id || '';
    document.getElementById('cue-trigger-tc').value = fmtTC(c.trigger_tc);
    document.getElementById('cue-warn').value = c.warn_seconds;
    document.getElementById('cue-notes').value = c.notes;
  } else {
    document.getElementById('cue-modal-title').textContent = 'Add Cue';
    document.getElementById('cue-number').value = '';
    document.getElementById('cue-label').value = '';
    if (actSel) actSel.value = '';
    document.getElementById('cue-trigger-tc').value = CONST.DEFAULT_TC;
    document.getElementById('cue-warn').value = String(CONST.DEFAULT_WARN_SEC);
    document.getElementById('cue-notes').value = '';
  }
  modal.classList.add('open');
  document.getElementById('cue-label').focus();
}

/**
 * Save a cue (create or update) from the modal form.
 */
async function saveCue() {
  const id = document.getElementById('cue-edit-id').value;
  const actVal = document.getElementById('cue-act') ? document.getElementById('cue-act').value : '';
  const body = {
    id: id || CONST.NULL_UUID,
    department_id: document.getElementById('cue-dept').value,
    cue_number: document.getElementById('cue-number').value,
    label: document.getElementById('cue-label').value,
    trigger_tc: parseTC(document.getElementById('cue-trigger-tc').value),
    warn_seconds: parseInt(document.getElementById('cue-warn').value) || CONST.DEFAULT_WARN_SEC,
    notes: document.getElementById('cue-notes').value,
    act_id: actVal || null,
  };
  try {
    if (id) {
      await api(`/cues/${id}`, { method: 'PUT', body });
    } else {
      await api('/cues', { method: 'POST', body });
    }
    closeModal('cue-modal');
    showToast(id ? 'Cue updated' : 'Cue created', 'success');
  } catch (e) {
    showToast(`Failed to save cue: ${e.message}`, 'error');
  }
  refreshManageView();
}

/**
 * Delete a cue after confirmation.
 * @param {string} id - Cue UUID.
 */
async function deleteCue(id) {
  const ok = await showConfirm('Delete Cue', 'Delete this cue?');
  if (!ok) return;
  try {
    await api(`/cues/${id}`, { method: 'DELETE' });
    showToast('Cue deleted', 'success');
  } catch (e) {
    showToast('Failed to delete cue', 'error');
  }
  refreshManageView();
}

// ── Act CRUD ────────────────────────────────

function renderActList() {
  const el = document.getElementById('act-list');
  if (!el) return;
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

async function saveAct() {
  const id = document.getElementById('act-edit-id').value;
  const body = {
    id: id || CONST.NULL_UUID,
    name: document.getElementById('act-name').value,
    sort_order: parseInt(document.getElementById('act-sort-order').value) || 1,
  };
  try {
    if (id) {
      await api(`/acts/${id}`, { method: 'PUT', body });
    } else {
      await api('/acts', { method: 'POST', body });
    }
    closeModal('act-modal');
    showToast(id ? 'Act updated' : 'Act created', 'success');
  } catch (e) {
    showToast(`Failed to save act: ${e.message}`, 'error');
  }
  refreshManageView();
}

async function deleteAct(id) {
  const ok = await showConfirm('Delete Act', 'Delete this act? Cues will be unassigned.');
  if (!ok) return;
  try {
    await api(`/acts/${id}`, { method: 'DELETE' });
    showToast('Act deleted', 'success');
  } catch (e) {
    showToast('Failed to delete act', 'error');
  }
  refreshManageView();
}

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
