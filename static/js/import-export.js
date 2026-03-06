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
  const data = JSON.stringify({ departments, cues }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'showpulse-export.json';
  a.click();
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
