/* ══════════════════════════════════════════
   timeline.js — Interactive timeline editor
   ══════════════════════════════════════════
   Sections:
     State         — zoom/pan view window (tlView)
     Render        — renderTimeline (act bands, cue markers, playhead, labels, minimap)
     Playhead      — updateTimelinePlayhead (5Hz tick from current TC)
     Zoom & Pan    — initTimelineInteraction (wheel zoom, drag pan, click-to-scrub)
     Tooltip       — hover cue markers for rich info popup
     Selection     — two-way sync between timeline markers and cue list
     Navigation    — scrollToCueItem (click marker → scroll + highlight cue)
     Helpers       — tlSecToPct, tlPctToSec, tlFormatTime
   Dependencies: state.js (DOM, cues, acts, CONST, tcObjToSeconds, tcToSeconds,
                  secondsToTcObj, getDeptColor, esc, fmtTC, parseTC)
                  show.js (canControlTimer)
                  api.js (api)
                  manage.js (selectedCues)
   ══════════════════════════════════════════ */

// ── State ───────────────────────────────────

/** Timeline view window — null means "fit all cues" (1x zoom). */
const tlView = {
  start: null,   // visible start (seconds)
  end: null,     // visible end (seconds)
  fullMin: 0,    // data range min (seconds, with padding)
  fullMax: 1,    // data range max (seconds, with padding)
};

/** Whether the user is currently panning. */
let tlPanning = false;

/** Pan start state. */
let tlPanStart = { x: 0, viewStart: 0, viewEnd: 0 };

/** Tooltip element (created once, reused). */
let tlTooltip = null;

// ── Helpers ─────────────────────────────────

/** Convert seconds to percentage within current view window. */
function tlSecToPct(sec) {
  const start = tlView.start != null ? tlView.start : tlView.fullMin;
  const end = tlView.end != null ? tlView.end : tlView.fullMax;
  const range = end - start || 1;
  return (sec - start) / range * 100;
}

/** Convert a percentage (0-100) within current view to seconds. */
function tlPctToSec(pct) {
  const start = tlView.start != null ? tlView.start : tlView.fullMin;
  const end = tlView.end != null ? tlView.end : tlView.fullMax;
  return start + (pct / 100) * (end - start);
}

/** Format seconds as a human-readable time label. */
function tlFormatTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── Render ──────────────────────────────────

/**
 * Render the visual timeline above the cue list.
 * Shows act regions, department-colored cue markers, playhead, time labels, and minimap.
 */
function renderTimeline() {
  const strip = DOM.timelineStrip;
  if (!strip) return;
  if (cues.length === 0) { strip.innerHTML = ''; return; }

  // Compute full data range
  const times = cues.map(c => tcObjToSeconds(c.trigger_tc)).sort((a, b) => a - b);
  const pad = Math.max(10, (times[times.length - 1] - times[0]) * 0.03);
  tlView.fullMin = Math.max(0, times[0] - pad);
  tlView.fullMax = times[times.length - 1] + pad;

  // Current view window
  const vStart = tlView.start != null ? tlView.start : tlView.fullMin;
  const vEnd = tlView.end != null ? tlView.end : tlView.fullMax;
  const vRange = vEnd - vStart || 1;
  const pct = (sec) => ((sec - vStart) / vRange * 100).toFixed(2);

  // Act bands
  let bands = '';
  const sortedActs = acts.slice().sort((a, b) => a.sort_order - b.sort_order);
  for (const act of sortedActs) {
    const ac = cues.filter(c => c.act_id === act.id);
    if (ac.length === 0) continue;
    const at = ac.map(c => tcObjToSeconds(c.trigger_tc));
    const aMin = Math.min(...at);
    const aMax = Math.max(...at);
    const l = parseFloat(pct(aMin));
    const r = parseFloat(pct(aMax));
    const w = Math.max(r - l, 0.3);
    bands += `<div class="tl-act" style="left:${l}%;width:${w}%" title="${esc(act.name)}"></div>`;
  }

  // Selected cues set (for highlight)
  const selSet = (typeof selectedCues !== 'undefined') ? selectedCues : new Set();

  // Cue markers
  let markers = '';
  for (const c of cues) {
    const color = getDeptColor(c.department_id);
    const left = parseFloat(pct(tcObjToSeconds(c.trigger_tc)));
    if (left < -5 || left > 105) continue;
    const sel = selSet.has(c.id) ? ' tl-cue--selected' : '';
    markers += `<div class="tl-cue${sel}" style="left:${left}%;background:${color}" data-cue-id="${c.id}"></div>`;
  }

  // Time labels
  let labels = '';
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const sec = vStart + vRange * i / n;
    labels += `<span style="left:${(i / n * 100).toFixed(1)}%">${tlFormatTime(sec)}</span>`;
  }

  // Minimap (shows full range with viewport indicator)
  const isZoomed = tlView.start != null;
  let minimap = '';
  if (isZoomed) {
    const fullRange = tlView.fullMax - tlView.fullMin || 1;
    let miniMarkers = '';
    for (const c of cues) {
      const color = getDeptColor(c.department_id);
      const left = ((tcObjToSeconds(c.trigger_tc) - tlView.fullMin) / fullRange * 100).toFixed(2);
      miniMarkers += `<div class="tl-mini-cue" style="left:${left}%;background:${color}"></div>`;
    }
    const vpLeft = ((vStart - tlView.fullMin) / fullRange * 100).toFixed(2);
    const vpWidth = ((vEnd - vStart) / fullRange * 100).toFixed(2);
    minimap = `<div class="tl-minimap"><div class="tl-mini-track">${miniMarkers}<div class="tl-mini-viewport" style="left:${vpLeft}%;width:${vpWidth}%"></div></div></div>`;
  }

  strip.innerHTML =
    `<div class="tl-track" id="tl-track">${bands}${markers}<div class="tl-playhead" id="tl-playhead"></div></div>` +
    `<div class="tl-labels">${labels}</div>` +
    minimap;

  strip.dataset.minT = vStart;
  strip.dataset.range = vRange;
}

// ── Playhead ────────────────────────────────

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

// ── Tooltip ─────────────────────────────────

/** Create the tooltip element once. */
function ensureTooltip() {
  if (tlTooltip) return;
  tlTooltip = document.createElement('div');
  tlTooltip.className = 'tl-tooltip';
  document.body.appendChild(tlTooltip);
}

/** Show rich tooltip for a cue marker. */
function showTlTooltip(marker, e) {
  ensureTooltip();
  const cueId = marker.dataset.cueId;
  const c = cues.find(c => c.id === cueId);
  if (!c) return;

  const dept = departments.find(d => d.id === c.department_id);
  const deptName = dept ? dept.name : '?';
  const deptColor = dept ? dept.color : CONST.DEFAULT_DEPT_COLOR;
  const tc = fmtTC(c.trigger_tc);

  tlTooltip.innerHTML =
    `<div class="tl-tip-label">${esc(c.label)}</div>` +
    `<div class="tl-tip-tc">${tc}</div>` +
    `<div class="tl-tip-dept"><span class="tl-tip-dot" style="background:${deptColor}"></span>${esc(deptName)}</div>` +
    (c.warn_seconds ? `<div class="tl-tip-warn">Warn: ${c.warn_seconds}s</div>` : '');

  // Position above the marker
  const rect = marker.getBoundingClientRect();
  tlTooltip.style.left = rect.left + rect.width / 2 + 'px';
  tlTooltip.style.top = rect.top - 6 + 'px';
  tlTooltip.classList.add('visible');
}

/** Hide the tooltip. */
function hideTlTooltip() {
  if (tlTooltip) tlTooltip.classList.remove('visible');
}

// ── Selection Sync ──────────────────────────

/** Highlight selected cues on the timeline (called after selection changes in cue list). */
function syncTimelineSelection() {
  const strip = DOM.timelineStrip;
  if (!strip) return;
  const selSet = (typeof selectedCues !== 'undefined') ? selectedCues : new Set();
  strip.querySelectorAll('.tl-cue').forEach(el => {
    el.classList.toggle('tl-cue--selected', selSet.has(el.dataset.cueId));
  });
}

// ── Zoom & Pan ──────────────────────────────

/** Initialize timeline mouse interactions. Call once after initDOM(). */
function initTimelineInteraction() {
  const strip = DOM.timelineStrip;
  if (!strip) return;

  // Wheel → zoom centered on cursor
  strip.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (cues.length === 0) return;

    const track = document.getElementById('tl-track');
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const cursorPct = Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width * 100));
    const cursorSec = tlPctToSec(cursorPct);

    const zoomFactor = e.deltaY < 0 ? 0.8 : 1.25;

    const vStart = tlView.start != null ? tlView.start : tlView.fullMin;
    const vEnd = tlView.end != null ? tlView.end : tlView.fullMax;
    const vRange = vEnd - vStart;

    const newRange = vRange * zoomFactor;
    const fullRange = tlView.fullMax - tlView.fullMin;

    if (newRange >= fullRange) {
      tlView.start = null;
      tlView.end = null;
      renderTimeline();
      return;
    }

    if (newRange < 5) return;

    const cursorRatio = (cursorSec - vStart) / vRange;
    let newStart = cursorSec - cursorRatio * newRange;
    let newEnd = newStart + newRange;

    if (newStart < tlView.fullMin) { newStart = tlView.fullMin; newEnd = newStart + newRange; }
    if (newEnd > tlView.fullMax) { newEnd = tlView.fullMax; newStart = newEnd - newRange; }

    tlView.start = Math.max(tlView.fullMin, newStart);
    tlView.end = Math.min(tlView.fullMax, newEnd);
    renderTimeline();
  }, { passive: false });

  // Mouse drag → pan / click-to-scrub / click marker
  strip.addEventListener('mousedown', (e) => {
    if (cues.length === 0) return;
    const target = e.target;

    // Click on cue marker → select + scroll
    if (target.classList.contains('tl-cue')) {
      const cueId = target.dataset.cueId;
      if (cueId) {
        scrollToCueItem(cueId);
        // Toggle selection in cue list
        if (typeof handleCueCheck === 'function') {
          const isSelected = (typeof selectedCues !== 'undefined') && selectedCues.has(cueId);
          handleCueCheck(cueId, !isSelected, e);
          syncTimelineSelection();
        }
      }
      return;
    }

    const track = document.getElementById('tl-track');
    if (!track || !track.contains(target)) return;

    // If not zoomed, click-to-scrub only
    if (tlView.start == null) {
      handleTimelineScrub(e);
      return;
    }

    e.preventDefault();
    tlPanning = true;
    tlPanStart.x = e.clientX;
    tlPanStart.viewStart = tlView.start;
    tlPanStart.viewEnd = tlView.end;
    strip.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', (e) => {
    if (!tlPanning) return;
    const track = document.getElementById('tl-track');
    if (!track) return;

    const rect = track.getBoundingClientRect();
    const dx = e.clientX - tlPanStart.x;
    const pctShift = (dx / rect.width) * (tlPanStart.viewEnd - tlPanStart.viewStart);

    let newStart = tlPanStart.viewStart - pctShift;
    let newEnd = tlPanStart.viewEnd - pctShift;

    if (newStart < tlView.fullMin) { newEnd += (tlView.fullMin - newStart); newStart = tlView.fullMin; }
    if (newEnd > tlView.fullMax) { newStart -= (newEnd - tlView.fullMax); newEnd = tlView.fullMax; }

    tlView.start = Math.max(tlView.fullMin, newStart);
    tlView.end = Math.min(tlView.fullMax, newEnd);
    renderTimeline();
  });

  document.addEventListener('mouseup', () => {
    if (tlPanning) {
      tlPanning = false;
      if (DOM.timelineStrip) DOM.timelineStrip.style.cursor = '';
    }
  });

  // Double-click → reset zoom to fit all
  strip.addEventListener('dblclick', (e) => {
    if (e.target.classList.contains('tl-cue')) return;
    tlView.start = null;
    tlView.end = null;
    renderTimeline();
  });

  // Tooltip: hover on cue markers (event delegation)
  strip.addEventListener('mouseover', (e) => {
    if (e.target.classList.contains('tl-cue')) showTlTooltip(e.target, e);
  });
  strip.addEventListener('mouseout', (e) => {
    if (e.target.classList.contains('tl-cue')) hideTlTooltip();
  });
}

/** Handle click-to-scrub: click on track → goto that timecode. */
function handleTimelineScrub(e) {
  const track = document.getElementById('tl-track');
  if (!track) return;

  const rect = track.getBoundingClientRect();
  const pct = Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width * 100));
  const sec = tlPctToSec(pct);
  const tc = secondsToTcObj(sec);
  const tcStr = fmtTC(tc);

  if (DOM.gotoTc) DOM.gotoTc.value = tcStr;
  if (typeof canControlTimer === 'function' && !canControlTimer()) return;

  api('/generator/goto', { method: 'POST', body: { timecode: tc } }).catch(() => {});
}

// ── Navigation ──────────────────────────────

/** Scroll to a cue item in the list and briefly highlight it. */
function scrollToCueItem(cueId) {
  const item = DOM.cueListBody.querySelector(`.cue-item[data-cue-id="${cueId}"]`);
  if (!item) return;
  const group = item.closest('.cue-act-group');
  if (group && group.classList.contains('collapsed')) {
    const actId = group.dataset.actId;
    if (actId) toggleCueActGroup(actId);
  }
  item.scrollIntoView({ behavior: 'smooth', block: 'center' });
  item.classList.add('cue-highlight');
  setTimeout(() => item.classList.remove('cue-highlight'), 1500);
}
