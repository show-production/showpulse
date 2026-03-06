/* ══════════════════════════════════════════
   api.js — HTTP API wrapper and WebSocket connection
   ══════════════════════════════════════════
   Provides api() for REST calls and connectWS() for real-time updates.
   Dependencies: state.js
   Components: All (data layer)
   ══════════════════════════════════════════ */

/**
 * Make an API request to the backend.
 * @param {string} path - API path (e.g. "/departments").
 * @param {Object} [opts={}] - Fetch options. If opts.body is an object, it's JSON-serialized.
 * @returns {Promise<any>} Parsed JSON response, or null for 204.
 */
async function api(path, opts = {}) {
  if (opts.body && typeof opts.body === 'object') {
    opts.body = JSON.stringify(opts.body);
    opts.headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  }
  const r = await fetch('/api' + path, opts);
  if (r.status === 204) return null;
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || r.statusText);
  }
  return r.json();
}

/**
 * Establish a WebSocket connection for real-time timecode + cue updates.
 * Automatically reconnects on close.
 */
function connectWS() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}/ws`);

  ws.onopen = () => {
    wsConnected = true;
    DOM.wsDot.classList.add('connected');
    DOM.disconnectBanner.classList.remove('visible');
    DOM.flowTimecode.classList.remove('disconnected');
  };

  ws.onclose = () => {
    wsConnected = false;
    DOM.wsDot.classList.remove('connected');
    DOM.disconnectBanner.classList.add('visible');
    DOM.flowTimecode.classList.add('disconnected');
    setTimeout(connectWS, CONST.WS_RECONNECT_DELAY);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      DOM.tcValue.textContent = data.timecode;
      DOM.tcState.textContent = data.status.toUpperCase();
      DOM.tcState.className = data.status;
      DOM.tcFps.textContent = `${data.frame_rate} fps`;
      renderFlowCues(data.cues);
    } catch (e) {
      console.error('Invalid WS message:', e);
    }
  };
}
