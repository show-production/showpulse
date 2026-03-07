/* ══════════════════════════════════════════
   import-export.js — Export/import show JSON + CSV cue import
   ══════════════════════════════════════════
   Handles full show export/import and cue-only CSV/JSON import.
   Dependencies: state.js, api.js, ui-helpers.js (showToast)
   Components: DataActions, CuePanel (import button)
   ══════════════════════════════════════════ */

// ── Show export ────────────────────────────

/**
 * Export the current show (departments + cues) as a JSON file download.
 */
function exportShow() {
  const data = JSON.stringify({ departments, cues, acts, show_name: showName }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'showpulse-export.json';
  a.click();
}

// ── CSV export ────────────────────────────

/**
 * Export cues as a professional CSV file, sorted by act then timecode.
 */
function exportCSV() {
  const deptMap = {};
  departments.forEach(d => { deptMap[d.id] = d.name; });
  const actMap = {};
  acts.forEach(a => { actMap[a.id] = a.name; });

  const sorted = [...cues].sort((a, b) => {
    const actA = a.act_id ? (acts.find(x => x.id === a.act_id)?.sort_order ?? 999) : 999;
    const actB = b.act_id ? (acts.find(x => x.id === b.act_id)?.sort_order ?? 999) : 999;
    if (actA !== actB) return actA - actB;
    return tcObjToSeconds(a.trigger_tc) - tcObjToSeconds(b.trigger_tc);
  });

  const headers = ['Cue #', 'Label', 'Department', 'Act', 'Timecode', 'Warning (s)', 'Duration (s)', 'Armed', 'Continue', 'Notes'];
  const rows = sorted.map(c => [
    csvCell(c.cue_number || ''),
    csvCell(c.label || ''),
    csvCell(deptMap[c.department_id] || ''),
    csvCell(c.act_id ? (actMap[c.act_id] || '') : ''),
    fmtTC(c.trigger_tc),
    c.warn_seconds ?? '',
    c.duration ?? '',
    c.armed ? 'Yes' : 'No',
    c.continue_mode || 'stop',
    csvCell(c.notes || ''),
  ].join(','));

  const name = showName || 'ShowPulse';
  const csv = [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name.replace(/[^a-zA-Z0-9_-]/g, '_')}-cuesheet.csv`;
  a.click();
}

function csvCell(value) {
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// ── Print cue sheet ──────────────────────────

/**
 * Generate a professional print-friendly cue sheet and open the browser print dialog.
 */
function printCueSheet() {
  const deptMap = {};
  departments.forEach(d => { deptMap[d.id] = d; });
  const actMap = {};
  acts.forEach(a => { actMap[a.id] = a.name; });

  const sorted = [...cues].sort((a, b) => {
    const actA = a.act_id ? (acts.find(x => x.id === a.act_id)?.sort_order ?? 999) : 999;
    const actB = b.act_id ? (acts.find(x => x.id === b.act_id)?.sort_order ?? 999) : 999;
    if (actA !== actB) return actA - actB;
    return tcObjToSeconds(a.trigger_tc) - tcObjToSeconds(b.trigger_tc);
  });

  // Group by act
  const groups = [];
  let currentActId = null;
  for (const c of sorted) {
    const actId = c.act_id || '__none__';
    if (actId !== currentActId) {
      currentActId = actId;
      groups.push({ act: c.act_id ? (actMap[c.act_id] || 'Unknown Act') : 'Unassigned', cues: [] });
    }
    groups[groups.length - 1].cues.push(c);
  }

  const name = showName || 'ShowPulse';
  const now = new Date().toLocaleString();

  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(name)} — Cue Sheet</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10pt; color: #111; padding: 0.5in; }
  .header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 3px solid #111; padding-bottom: 8px; margin-bottom: 16px; }
  .header h1 { font-size: 18pt; font-weight: 700; }
  .header .meta { font-size: 8pt; color: #666; text-align: right; }
  .act-title { font-size: 11pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin: 16px 0 6px; padding: 4px 8px; background: #f0f0f0; border-left: 4px solid #333; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { text-align: left; font-size: 7pt; text-transform: uppercase; letter-spacing: 0.08em; color: #666; font-weight: 600; padding: 4px 6px; border-bottom: 2px solid #ccc; }
  td { padding: 5px 6px; border-bottom: 1px solid #ddd; font-size: 9pt; vertical-align: top; }
  tr:nth-child(even) { background: #fafafa; }
  .tc { font-family: 'Courier New', monospace; font-size: 9pt; }
  .dept-dot { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 4px; vertical-align: middle; }
  .notes { color: #555; font-size: 8pt; max-width: 200px; }
  .disarmed { opacity: 0.4; }
  .footer { margin-top: 20px; font-size: 7pt; color: #999; text-align: center; border-top: 1px solid #ddd; padding-top: 6px; }
  @media print {
    body { padding: 0; }
    .act-title { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    tr:nth-child(even) { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .dept-dot { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  @page { margin: 0.5in; size: landscape; }
</style></head><body>`;

  html += `<div class="header"><h1>${esc(name)}</h1><div class="meta">Cue Sheet<br>${esc(now)}<br>${cues.length} cues &middot; ${departments.length} departments &middot; ${acts.length} acts</div></div>`;

  for (const group of groups) {
    html += `<div class="act-title">${esc(group.act)}</div>`;
    html += `<table><thead><tr><th style="width:60px">Cue #</th><th>Label</th><th style="width:100px">Department</th><th style="width:90px">Timecode</th><th style="width:50px">Warn</th><th style="width:55px">Duration</th><th style="width:45px">Armed</th><th>Notes</th></tr></thead><tbody>`;
    for (const c of group.cues) {
      const dept = deptMap[c.department_id];
      const deptName = dept ? dept.name : '';
      const deptColor = dept ? dept.color : '#888';
      const armed = c.armed !== false;
      const rowClass = armed ? '' : ' class="disarmed"';
      const dur = c.duration != null ? `${c.duration}s` : '—';
      html += `<tr${rowClass}>`;
      html += `<td>${esc(c.cue_number || '')}</td>`;
      html += `<td>${esc(c.label || '')}</td>`;
      html += `<td><span class="dept-dot" style="background:${deptColor}"></span>${esc(deptName)}</td>`;
      html += `<td class="tc">${fmtTC(c.trigger_tc)}</td>`;
      html += `<td>${c.warn_seconds ?? ''}s</td>`;
      html += `<td>${dur}</td>`;
      html += `<td>${armed ? '✓' : '—'}</td>`;
      html += `<td class="notes">${esc(c.notes || '')}</td>`;
      html += `</tr>`;
    }
    html += `</tbody></table>`;
  }

  html += `<div class="footer">Generated by ShowPulse &middot; ${esc(now)}</div>`;
  html += `</body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

// ── Show import ────────────────────────────

/**
 * Import a full show JSON file (departments + cues), replacing existing data.
 * @param {Event} event - File input change event.
 */
function importShow(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const depts = data.departments || [];
      const importedCues = data.cues || [];

      const result = await api('/show/import', { method: 'POST', body: { departments: depts, cues: importedCues } });

      refreshManageView();
      let msg = `Replaced show: ${depts.length} department(s), ${result.imported} cue(s)`;
      if (result.errors.length > 0) {
        msg += ` (${result.errors.length} cue error(s))`;
      }
      showToast(msg, result.errors.length > 0 ? 'info' : 'success');
    } catch (err) {
      showToast(`Import failed: ${err.message}`, 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// ── CSV parsing ────────────────────────────

/**
 * Parse CSV text into an array of cue objects for bulk import.
 * Supports column aliases for flexible CSV formats.
 * @param {string} csvText - Raw CSV text.
 * @returns {Array<Object>} Array of cue objects ready for API.
 * @throws {Error} If CSV is invalid or department can't be resolved.
 */
function parseCsvToCues(csvText) {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const colMap = {};
  const aliases = {
    'label': ['label', 'name', 'cue', 'cue_name'],
    'department_id': ['department_id', 'dept_id'],
    'department': ['department', 'dept', 'department_name', 'dept_name'],
    'timecode': ['timecode', 'trigger_tc', 'tc', 'trigger'],
    'warn_seconds': ['warn_seconds', 'warn', 'warning', 'lead_time'],
    'notes': ['notes', 'note', 'description'],
  };
  for (const [field, names] of Object.entries(aliases)) {
    const idx = headers.findIndex(h => names.includes(h));
    if (idx !== -1) colMap[field] = idx;
  }

  const deptByName = {};
  departments.forEach(d => { deptByName[d.name.toLowerCase()] = d.id; });

  const cuesOut = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());

    let deptId = null;
    if (colMap.department_id !== undefined && cols[colMap.department_id]) {
      deptId = cols[colMap.department_id];
    } else if (colMap.department !== undefined && cols[colMap.department]) {
      deptId = deptByName[cols[colMap.department].toLowerCase()] || null;
    }
    if (!deptId) {
      throw new Error(`Row ${i + 1}: could not resolve department "${cols[colMap.department] || cols[colMap.department_id] || ''}"`);
    }

    const cue = { department_id: deptId };
    if (colMap.label !== undefined) cue.label = cols[colMap.label] || 'Untitled Cue';
    if (colMap.timecode !== undefined && cols[colMap.timecode]) {
      cue.trigger_tc = parseTC(cols[colMap.timecode]);
    }
    if (colMap.warn_seconds !== undefined && cols[colMap.warn_seconds]) {
      cue.warn_seconds = parseInt(cols[colMap.warn_seconds]) || CONST.DEFAULT_WARN_SEC;
    }
    if (colMap.notes !== undefined) cue.notes = cols[colMap.notes] || '';
    cuesOut.push(cue);
  }
  return cuesOut;
}

// ── Cue import (Manage view) ───────────────

/**
 * Import cues from a JSON or CSV file (Manage view import button).
 * @param {Event} event - File input change event.
 */
async function importCues(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const text = e.target.result;
      let cuesPayload;

      if (file.name.endsWith('.csv')) {
        cuesPayload = parseCsvToCues(text);
      } else {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          cuesPayload = parsed;
        } else if (parsed.cues && Array.isArray(parsed.cues)) {
          cuesPayload = parsed.cues;
        } else {
          throw new Error('JSON must be an array of cues or { "cues": [...] }');
        }
      }

      if (cuesPayload.length === 0) {
        showToast('No cues found in file', 'info');
        return;
      }

      const result = await api('/cues/import', { method: 'POST', body: cuesPayload });

      if (result.errors.length === 0) {
        showToast(`Imported ${result.imported} cue(s) successfully`, 'success');
      } else {
        showToast(
          `Imported ${result.imported}, failed ${result.errors.length}. First error: ${result.errors[0].message}`,
          result.imported > 0 ? 'info' : 'error',
          5000
        );
      }
      refreshManageView();
    } catch (err) {
      showToast(`Import failed: ${err.message}`, 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}
