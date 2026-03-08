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
 * Format a duration in seconds as a human-readable string.
 * @param {number} sec - Duration in seconds.
 * @returns {string} e.g. "1h 23m 45s", "23m 45s", or "45s"
 */
function _fmtDuration(sec) {
  if (sec == null || isNaN(sec)) return '—';
  sec = Math.round(Math.abs(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Compute comprehensive show analytics from the global cues, departments, acts arrays.
 * @returns {Object} Analytics object with all computed metrics.
 */
function _computeShowAnalytics() {
  const deptMap = {};
  departments.forEach(d => { deptMap[d.id] = d; });
  const actMap = {};
  acts.forEach(a => { actMap[a.id] = a; });

  // Sort cues by act then timecode
  const sorted = [...cues].sort((a, b) => {
    const actA = a.act_id ? (acts.find(x => x.id === a.act_id)?.sort_order ?? 999) : 999;
    const actB = b.act_id ? (acts.find(x => x.id === b.act_id)?.sort_order ?? 999) : 999;
    if (actA !== actB) return actA - actB;
    return tcObjToSeconds(a.trigger_tc) - tcObjToSeconds(b.trigger_tc);
  });

  const armedCues = sorted.filter(c => c.armed !== false);
  const disarmedCues = sorted.filter(c => c.armed === false);

  // TC seconds for armed cues
  const armedTCSecs = armedCues.map(c => tcObjToSeconds(c.trigger_tc));

  // Show duration: first armed cue TC to last armed cue TC + its duration
  let showDurationSec = 0;
  let firstArmedTC = null;
  let lastArmedTC = null;
  if (armedCues.length > 0) {
    firstArmedTC = Math.min(...armedTCSecs);
    const lastIdx = armedTCSecs.indexOf(Math.max(...armedTCSecs));
    lastArmedTC = armedTCSecs[lastIdx];
    const lastDur = armedCues[lastIdx].duration || 0;
    showDurationSec = (lastArmedTC + lastDur) - firstArmedTC;
  }

  // Total content duration
  const totalContentDuration = armedCues.reduce((sum, c) => sum + (c.duration || 0), 0);

  // Unique departments & acts
  const deptIds = new Set(cues.map(c => c.department_id).filter(Boolean));
  const actIds = new Set(cues.map(c => c.act_id).filter(Boolean));

  // Pacing: gaps between consecutive armed cues
  const gaps = [];
  for (let i = 1; i < armedTCSecs.length; i++) {
    gaps.push(armedTCSecs[i] - armedTCSecs[i - 1]);
  }
  const avgGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  const longestGap = gaps.length > 0 ? Math.max(...gaps) : 0;
  const tightestGap = gaps.length > 0 ? Math.min(...gaps) : 0;

  // Peak concurrent cues (sweep-line algorithm)
  const events = [];
  for (const c of armedCues) {
    const start = tcObjToSeconds(c.trigger_tc);
    const end = start + (c.duration || 0);
    events.push({ time: start, type: 1 });
    if (c.duration) events.push({ time: end, type: -1 });
  }
  events.sort((a, b) => a.time - b.time || b.type - a.type);
  let peakConcurrent = 0;
  let concurrent = 0;
  for (const ev of events) {
    concurrent += ev.type;
    if (concurrent > peakConcurrent) peakConcurrent = concurrent;
  }

  // Average warning lead time
  const warnValues = armedCues.filter(c => c.warn_seconds != null).map(c => c.warn_seconds);
  const avgWarn = warnValues.length > 0 ? warnValues.reduce((a, b) => a + b, 0) / warnValues.length : 0;

  // Overlap detection: gaps < 0
  const overlaps = gaps.filter(g => g < 0);

  // Continue mode breakdown
  const continueBreakdown = { stop: 0, auto_continue: 0, auto_follow: 0 };
  for (const c of cues) {
    const mode = c.continue_mode || 'stop';
    if (continueBreakdown[mode] !== undefined) continueBreakdown[mode]++;
    else continueBreakdown.stop++;
  }

  // Automation rate: (auto_continue + auto_follow) / total
  const automationRate = cues.length > 0
    ? ((continueBreakdown.auto_continue + continueBreakdown.auto_follow) / cues.length) * 100
    : 0;

  // Department summary
  const deptSummary = [];
  for (const d of departments) {
    const deptCues = sorted.filter(c => c.department_id === d.id);
    const deptArmed = deptCues.filter(c => c.armed !== false);
    const deptDisarmed = deptCues.filter(c => c.armed === false);
    const deptTCSecs = deptArmed.map(c => tcObjToSeconds(c.trigger_tc));
    const firstTC = deptTCSecs.length > 0 ? Math.min(...deptTCSecs) : null;
    const lastTC = deptTCSecs.length > 0 ? Math.max(...deptTCSecs) : null;
    const span = firstTC != null && lastTC != null ? lastTC - firstTC : 0;
    const contentDur = deptArmed.reduce((sum, c) => sum + (c.duration || 0), 0);
    const deptWarns = deptArmed.filter(c => c.warn_seconds != null).map(c => c.warn_seconds);
    const deptAvgWarn = deptWarns.length > 0 ? deptWarns.reduce((a, b) => a + b, 0) / deptWarns.length : 0;
    const notesCount = deptCues.filter(c => c.notes && c.notes.trim()).length;
    const notesCoverage = deptCues.length > 0 ? (notesCount / deptCues.length) * 100 : 0;
    deptSummary.push({
      dept: d,
      total: deptCues.length,
      armed: deptArmed.length,
      disarmed: deptDisarmed.length,
      firstTC,
      lastTC,
      span,
      contentDur,
      avgWarn: deptAvgWarn,
      notesCoverage,
    });
  }

  // Group by act
  const actGroups = [];
  let currentActId = null;
  for (const c of sorted) {
    const actId = c.act_id || '__none__';
    if (actId !== currentActId) {
      currentActId = actId;
      const actObj = c.act_id ? actMap[c.act_id] : null;
      actGroups.push({
        actId: c.act_id,
        actName: actObj ? actObj.name : 'Unassigned',
        cues: [],
      });
    }
    actGroups[actGroups.length - 1].cues.push(c);
  }

  // Per-act stats
  const actStats = actGroups.map(g => {
    const aCues = g.cues;
    const aArmed = aCues.filter(c => c.armed !== false);
    const aTCSecs = aArmed.map(c => tcObjToSeconds(c.trigger_tc));
    const startTC = aTCSecs.length > 0 ? Math.min(...aTCSecs) : null;
    const endTC = aTCSecs.length > 0 ? Math.max(...aTCSecs) : null;
    const lastIdx = aTCSecs.length > 0 ? aTCSecs.indexOf(Math.max(...aTCSecs)) : -1;
    const lastDur = lastIdx >= 0 ? (aArmed[lastIdx].duration || 0) : 0;
    const duration = startTC != null && endTC != null ? (endTC + lastDur) - startTC : 0;
    const contentDur = aArmed.reduce((sum, c) => sum + (c.duration || 0), 0);
    const aDeptIds = new Set(aCues.map(c => c.department_id).filter(Boolean));
    const aDeptNames = [...aDeptIds].map(id => deptMap[id] ? deptMap[id].name : '?');
    return {
      actName: g.actName,
      actId: g.actId,
      total: aCues.length,
      armed: aArmed.length,
      startTC,
      endTC,
      duration,
      contentDur,
      deptCount: aDeptIds.size,
      deptNames: aDeptNames,
      cues: aCues,
    };
  });

  return {
    sorted,
    armedCues,
    disarmedCues,
    showDurationSec,
    firstArmedTC,
    lastArmedTC,
    totalContentDuration,
    deptCount: deptIds.size,
    actCount: actIds.size,
    avgGap,
    longestGap,
    tightestGap,
    peakConcurrent,
    avgWarn,
    overlaps,
    continueBreakdown,
    automationRate,
    deptSummary,
    actGroups,
    actStats,
    deptMap,
    actMap,
  };
}

/**
 * Generate a comprehensive analytical show report and open the browser print dialog.
 */
function printCueSheet() {
  const a = _computeShowAnalytics();
  const name = showName || 'ShowPulse';
  const now = new Date().toLocaleString();
  const maxDeptCues = Math.max(1, ...a.deptSummary.map(d => d.total));
  const maxActDur = Math.max(1, ...a.actStats.map(s => s.duration));

  // Mono-dark logo for print (no external fonts)
  const printLogo = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 200" width="200" height="56" style="vertical-align:middle"><polyline points="20,100 50,100 60,88 68,112 76,92" fill="none" stroke="#1A1A2E" stroke-opacity="0.4" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/><polyline points="76,92 90,148 106,42 122,148 140,42 170,100" fill="none" stroke="#1A1A2E" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="170" y1="100" x2="220" y2="100" stroke="#1A1A2E" stroke-opacity="0.4" stroke-width="4.5" stroke-linecap="round"/><text x="260" y="122" style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;font-size:72px;font-weight:600;fill:#1A1A2E">ShowPulse</text></svg>';
  const printMark = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200" width="16" height="13" style="vertical-align:-1px;margin-right:3px"><polyline points="20,100 50,100 60,88 68,112 76,92" fill="none" stroke="#1A1A2E" stroke-opacity="0.4" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><polyline points="76,92 90,148 106,42 122,148 140,42 170,100" fill="none" stroke="#1A1A2E" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><line x1="170" y1="100" x2="230" y2="100" stroke="#1A1A2E" stroke-opacity="0.4" stroke-width="5" stroke-linecap="round"/></svg>';

  // Global timeline range for density visualization
  const timelineStart = a.firstArmedTC != null ? a.firstArmedTC : 0;
  const timelineEnd = a.lastArmedTC != null ? a.lastArmedTC + (a.armedCues.length > 0 ? (a.armedCues[a.armedCues.length - 1].duration || 0) : 0) : 1;
  const timelineSpan = Math.max(1, timelineEnd - timelineStart);

  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(name)} — Show Report</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10pt; color: #111; padding: 0.5in; }
  h1 { font-size: 20pt; font-weight: 700; }
  h2 { font-size: 14pt; font-weight: 700; margin: 18px 0 10px; border-bottom: 2px solid #333; padding-bottom: 4px; }
  h3 { font-size: 11pt; font-weight: 700; margin: 14px 0 6px; }
  .header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 3px solid #111; padding-bottom: 8px; margin-bottom: 16px; }
  .header .meta { font-size: 8pt; color: #666; text-align: right; }
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 12px 0; }
  .stat-card { background: #f7f7f7; border: 1px solid #e0e0e0; border-radius: 6px; padding: 10px 12px; }
  .stat-card .stat-label { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.08em; color: #888; margin-bottom: 2px; }
  .stat-card .stat-value { font-size: 16pt; font-weight: 700; color: #222; }
  .stat-card .stat-sub { font-size: 8pt; color: #999; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { text-align: left; font-size: 7pt; text-transform: uppercase; letter-spacing: 0.08em; color: #666; font-weight: 600; padding: 4px 6px; border-bottom: 2px solid #ccc; }
  td { padding: 5px 6px; border-bottom: 1px solid #ddd; font-size: 9pt; vertical-align: top; }
  tr:nth-child(even) { background: #fafafa; }
  .tc { font-family: 'Courier New', monospace; font-size: 9pt; }
  .dept-dot { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 4px; vertical-align: middle; }
  .notes-cell { color: #555; font-size: 8pt; max-width: 180px; }
  .disarmed { opacity: 0.4; }
  .tag { display: inline-block; font-size: 7pt; font-weight: 600; padding: 1px 6px; border-radius: 3px; text-transform: uppercase; letter-spacing: 0.04em; }
  .tag-stop { background: #e0e0e0; color: #555; }
  .tag-auto { background: #d0e4f7; color: #1a5fa0; }
  .tag-follow { background: #d4edda; color: #1b6d2f; }
  .bar-chart { margin: 10px 0 16px; }
  .bar-row { display: flex; align-items: center; margin-bottom: 4px; }
  .bar-label { width: 120px; font-size: 8pt; text-align: right; padding-right: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar-track { flex: 1; height: 18px; background: #f0f0f0; border-radius: 3px; overflow: hidden; position: relative; }
  .bar-fill { height: 100%; border-radius: 3px; display: flex; align-items: center; padding-left: 6px; font-size: 7pt; font-weight: 600; color: #fff; min-width: 24px; }
  .act-title { font-size: 11pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin: 16px 0 6px; padding: 4px 8px; background: #f0f0f0; border-left: 4px solid #333; }
  .act-title .act-stats { font-size: 8pt; font-weight: 400; color: #666; margin-left: 10px; text-transform: none; letter-spacing: normal; }
  .timeline-container { position: relative; height: 20px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 3px; margin: 4px 0; overflow: hidden; }
  .timeline-bar { position: absolute; height: 14px; top: 3px; border-radius: 2px; opacity: 0.85; }
  .disarmed-list { margin: 8px 0; padding: 0; }
  .disarmed-list li { font-size: 9pt; margin-bottom: 2px; list-style: none; padding-left: 12px; position: relative; }
  .disarmed-list li::before { content: '\\2716'; position: absolute; left: 0; color: #c0392b; font-size: 8pt; }
  .section-break { page-break-before: always; }
  .footer { margin-top: 20px; font-size: 7pt; color: #999; text-align: center; border-top: 1px solid #ddd; padding-top: 6px; }
  .overlap-warn { color: #c0392b; font-weight: 600; }
  .pacing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 8px 0; }
  .continue-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 8px 0; }
  @media print {
    body { padding: 0; }
    .stat-card, .act-title, .bar-fill, .tag, .timeline-bar, .dept-dot, .bar-track {
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    tr:nth-child(even) { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  @page { size: landscape; margin: 0.5in; }
</style></head><body>`;

  /* ═══════════════════════════════════════════
     PAGE 1 — Cover + Show Analytics
     ═══════════════════════════════════════════ */

  html += `<div class="header"><div>${printLogo}<h1 style="margin-top:8px">${esc(name)}</h1></div><div class="meta">Analytical Show Report<br>${esc(now)}</div></div>`;

  // KPI cards row 1
  html += `<div class="stats-grid">`;
  html += `<div class="stat-card"><div class="stat-label">Show Duration</div><div class="stat-value">${_fmtDuration(a.showDurationSec)}</div><div class="stat-sub">First to last armed cue + duration</div></div>`;
  html += `<div class="stat-card"><div class="stat-label">Active Cues</div><div class="stat-value">${a.armedCues.length} / ${cues.length}</div><div class="stat-sub">${a.disarmedCues.length} disarmed</div></div>`;
  html += `<div class="stat-card"><div class="stat-label">Total Content Duration</div><div class="stat-value">${_fmtDuration(a.totalContentDuration)}</div><div class="stat-sub">Sum of armed cue durations</div></div>`;
  html += `<div class="stat-card"><div class="stat-label">Departments / Acts</div><div class="stat-value">${a.deptCount} / ${a.actCount}</div><div class="stat-sub">${departments.length} depts defined, ${acts.length} acts defined</div></div>`;
  html += `</div>`;

  // KPI cards row 2
  html += `<div class="stats-grid">`;
  html += `<div class="stat-card"><div class="stat-label">Peak Concurrent Cues</div><div class="stat-value">${a.peakConcurrent}</div><div class="stat-sub">Max overlapping at any timecode</div></div>`;
  html += `<div class="stat-card"><div class="stat-label">Avg Warning Lead</div><div class="stat-value">${_fmtDuration(a.avgWarn)}</div><div class="stat-sub">Mean warn_seconds across armed cues</div></div>`;
  html += `<div class="stat-card"><div class="stat-label">Overlaps Detected</div><div class="stat-value${a.overlaps.length > 0 ? ' overlap-warn' : ''}">${a.overlaps.length}</div><div class="stat-sub">${a.overlaps.length > 0 ? 'Gaps &lt; 0 between consecutive cues' : 'No negative gaps'}</div></div>`;
  html += `<div class="stat-card"><div class="stat-label">Automation Rate</div><div class="stat-value">${a.automationRate.toFixed(1)}%</div><div class="stat-sub">${a.continueBreakdown.auto_continue + a.continueBreakdown.auto_follow} of ${cues.length} automated</div></div>`;
  html += `</div>`;

  // Pacing
  html += `<h3>Pacing</h3>`;
  html += `<div class="pacing-grid">`;
  html += `<div class="stat-card"><div class="stat-label">Average Gap</div><div class="stat-value">${_fmtDuration(a.avgGap)}</div></div>`;
  html += `<div class="stat-card"><div class="stat-label">Longest Gap</div><div class="stat-value">${_fmtDuration(a.longestGap)}</div></div>`;
  html += `<div class="stat-card"><div class="stat-label">Tightest Gap</div><div class="stat-value">${_fmtDuration(a.tightestGap)}</div></div>`;
  html += `</div>`;

  // Continue mode breakdown
  html += `<h3>Continue Mode Breakdown</h3>`;
  html += `<div class="continue-grid">`;
  html += `<div class="stat-card"><div class="stat-label">Stop</div><div class="stat-value">${a.continueBreakdown.stop}</div></div>`;
  html += `<div class="stat-card"><div class="stat-label">Auto Continue</div><div class="stat-value">${a.continueBreakdown.auto_continue}</div></div>`;
  html += `<div class="stat-card"><div class="stat-label">Auto Follow</div><div class="stat-value">${a.continueBreakdown.auto_follow}</div></div>`;
  html += `</div>`;

  // Disarmed cue listing
  if (a.disarmedCues.length > 0) {
    html += `<h3>Disarmed Cues (${a.disarmedCues.length})</h3>`;
    html += `<ul class="disarmed-list">`;
    for (const c of a.disarmedCues) {
      const dept = a.deptMap[c.department_id];
      html += `<li>${esc(c.cue_number || '—')} — ${esc(c.label || 'Untitled')} (${dept ? esc(dept.name) : '?'}, ${fmtTC(c.trigger_tc)})</li>`;
    }
    html += `</ul>`;
  }

  // Department summary table
  html += `<h3>Department Summary</h3>`;
  html += `<table><thead><tr><th>Department</th><th>Cues</th><th>Armed</th><th>Disarmed</th><th>First TC</th><th>Last TC</th><th>Span</th><th>Content Dur</th><th>Avg Warn</th><th>Notes %</th></tr></thead><tbody>`;
  for (const ds of a.deptSummary) {
    const color = ds.dept.color || '#888';
    html += `<tr>`;
    html += `<td><span class="dept-dot" style="background:${color}"></span>${esc(ds.dept.name)}</td>`;
    html += `<td>${ds.total}</td>`;
    html += `<td>${ds.armed}</td>`;
    html += `<td>${ds.disarmed}</td>`;
    html += `<td class="tc">${ds.firstTC != null ? _fmtDuration(ds.firstTC) : '—'}</td>`;
    html += `<td class="tc">${ds.lastTC != null ? _fmtDuration(ds.lastTC) : '—'}</td>`;
    html += `<td>${_fmtDuration(ds.span)}</td>`;
    html += `<td>${_fmtDuration(ds.contentDur)}</td>`;
    html += `<td>${_fmtDuration(ds.avgWarn)}</td>`;
    html += `<td>${ds.notesCoverage.toFixed(0)}%</td>`;
    html += `</tr>`;
  }
  html += `</tbody></table>`;

  // Department bar chart
  html += `<h3>Cues per Department</h3>`;
  html += `<div class="bar-chart">`;
  for (const ds of a.deptSummary) {
    const pct = (ds.total / maxDeptCues) * 100;
    const color = ds.dept.color || '#888';
    html += `<div class="bar-row">`;
    html += `<div class="bar-label">${esc(ds.dept.name)}</div>`;
    html += `<div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}">${ds.total}</div></div>`;
    html += `</div>`;
  }
  html += `</div>`;

  /* ═══════════════════════════════════════════
     PAGE 2 — Act Breakdown
     ═══════════════════════════════════════════ */

  html += `<div class="section-break"></div>`;
  html += `<div class="header"><div>${printLogo}<h1 style="margin-top:8px">${esc(name)}</h1></div><div class="meta">Act Breakdown<br>${esc(now)}</div></div>`;

  // Per-act stats table
  html += `<h2>Act Statistics</h2>`;
  html += `<table><thead><tr><th>Act</th><th>Cues</th><th>Armed</th><th>Start TC</th><th>End TC</th><th>Duration</th><th>Content Dur</th><th>Depts</th><th>Department Names</th></tr></thead><tbody>`;
  for (const as of a.actStats) {
    html += `<tr>`;
    html += `<td><strong>${esc(as.actName)}</strong></td>`;
    html += `<td>${as.total}</td>`;
    html += `<td>${as.armed}</td>`;
    html += `<td class="tc">${as.startTC != null ? _fmtDuration(as.startTC) : '—'}</td>`;
    html += `<td class="tc">${as.endTC != null ? _fmtDuration(as.endTC) : '—'}</td>`;
    html += `<td>${_fmtDuration(as.duration)}</td>`;
    html += `<td>${_fmtDuration(as.contentDur)}</td>`;
    html += `<td>${as.deptCount}</td>`;
    html += `<td>${esc(as.deptNames.join(', '))}</td>`;
    html += `</tr>`;
  }
  html += `</tbody></table>`;

  // Act duration bar chart
  html += `<h3>Act Duration</h3>`;
  html += `<div class="bar-chart">`;
  const actColors = ['#3498db', '#2ecc71', '#e67e22', '#9b59b6', '#e74c3c', '#1abc9c', '#f39c12', '#34495e'];
  for (let i = 0; i < a.actStats.length; i++) {
    const as = a.actStats[i];
    const pct = maxActDur > 0 ? (as.duration / maxActDur) * 100 : 0;
    const color = actColors[i % actColors.length];
    html += `<div class="bar-row">`;
    html += `<div class="bar-label">${esc(as.actName)}</div>`;
    html += `<div class="bar-track"><div class="bar-fill" style="width:${Math.max(pct, 2)}%;background:${color}">${_fmtDuration(as.duration)}</div></div>`;
    html += `</div>`;
  }
  html += `</div>`;

  // Timeline density visualization
  html += `<h3>Timeline Density</h3>`;
  html += `<p style="font-size:8pt;color:#888;margin-bottom:6px;">Each bar represents an armed cue positioned and sized by timecode and duration. Colors match department.</p>`;
  html += `<div style="position:relative;margin:8px 0 16px;">`;
  // Timeline axis labels
  html += `<div style="display:flex;justify-content:space-between;font-size:7pt;color:#999;margin-bottom:2px;">`;
  html += `<span>${_fmtDuration(timelineStart)}</span>`;
  html += `<span>${_fmtDuration(timelineStart + timelineSpan * 0.25)}</span>`;
  html += `<span>${_fmtDuration(timelineStart + timelineSpan * 0.5)}</span>`;
  html += `<span>${_fmtDuration(timelineStart + timelineSpan * 0.75)}</span>`;
  html += `<span>${_fmtDuration(timelineEnd)}</span>`;
  html += `</div>`;

  // Render a row per department for clarity
  for (const d of departments) {
    const deptArmed = a.armedCues.filter(c => c.department_id === d.id);
    if (deptArmed.length === 0) continue;
    html += `<div style="display:flex;align-items:center;margin-bottom:2px;">`;
    html += `<div style="width:120px;font-size:8pt;text-align:right;padding-right:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(d.name)}</div>`;
    html += `<div class="timeline-container" style="flex:1;">`;
    for (const c of deptArmed) {
      const cStart = tcObjToSeconds(c.trigger_tc);
      const cDur = c.duration || 1;
      const left = ((cStart - timelineStart) / timelineSpan) * 100;
      const width = Math.max((cDur / timelineSpan) * 100, 0.4);
      html += `<div class="timeline-bar" style="left:${left}%;width:${width}%;background:${d.color || '#888'};" title="${esc(c.cue_number || '')} ${esc(c.label || '')}"></div>`;
    }
    html += `</div></div>`;
  }
  html += `</div>`;

  /* ═══════════════════════════════════════════
     PAGE 3+ — Full Cue Listing
     ═══════════════════════════════════════════ */

  for (let gi = 0; gi < a.actGroups.length; gi++) {
    const group = a.actGroups[gi];
    const as = a.actStats[gi];

    html += `<div class="section-break"></div>`;
    html += `<div class="header"><div>${printLogo}<h1 style="margin-top:8px">${esc(name)}</h1></div><div class="meta">Cue Listing<br>${esc(now)}</div></div>`;

    html += `<div class="act-title">${esc(group.actName)}<span class="act-stats">${as.total} cue${as.total !== 1 ? 's' : ''} &middot; ${_fmtDuration(as.duration)}</span></div>`;
    html += `<table><thead><tr>`;
    html += `<th style="width:55px">Cue #</th>`;
    html += `<th>Label</th>`;
    html += `<th style="width:95px">Department</th>`;
    html += `<th style="width:85px">Timecode</th>`;
    html += `<th style="width:45px">Warn</th>`;
    html += `<th style="width:50px">Duration</th>`;
    html += `<th style="width:42px">Armed</th>`;
    html += `<th style="width:70px">Continue</th>`;
    html += `<th>Notes</th>`;
    html += `</tr></thead><tbody>`;

    for (const c of group.cues) {
      const dept = a.deptMap[c.department_id];
      const deptName = dept ? dept.name : '';
      const deptColor = dept ? dept.color : '#888';
      const armed = c.armed !== false;
      const rowClass = armed ? '' : ' class="disarmed"';
      const dur = c.duration != null ? `${c.duration}s` : '\u2014';
      const mode = c.continue_mode || 'stop';
      let tagClass = 'tag-stop';
      let tagLabel = 'STOP';
      if (mode === 'auto_continue') { tagClass = 'tag-auto'; tagLabel = 'AUTO'; }
      else if (mode === 'auto_follow') { tagClass = 'tag-follow'; tagLabel = 'FOLLOW'; }

      html += `<tr${rowClass}>`;
      html += `<td>${esc(c.cue_number || '')}</td>`;
      html += `<td>${esc(c.label || '')}</td>`;
      html += `<td><span class="dept-dot" style="background:${deptColor}"></span>${esc(deptName)}</td>`;
      html += `<td class="tc">${fmtTC(c.trigger_tc)}</td>`;
      html += `<td>${c.warn_seconds != null ? c.warn_seconds + 's' : '\u2014'}</td>`;
      html += `<td>${dur}</td>`;
      html += `<td>${armed ? '\u2713' : '\u2014'}</td>`;
      html += `<td><span class="tag ${tagClass}">${tagLabel}</span></td>`;
      html += `<td class="notes-cell">${esc(c.notes || '')}</td>`;
      html += `</tr>`;
    }
    html += `</tbody></table>`;
  }

  html += `<div class="footer">${printMark}Generated by ShowPulse &middot; ${esc(now)}</div>`;
  html += `</body></html>`;

  const win = window.open('', '_blank');
  if (!win) { showToast('Popup blocked — please allow popups for this site', 'error'); return; }
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
