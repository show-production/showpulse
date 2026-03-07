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
  // Inject auth token
  if (authToken) {
    opts.headers = { ...opts.headers, 'Authorization': `Bearer ${authToken}` };
  }
  const r = await fetch('/api' + path, opts);
  if (r.status === 204) return null;
  if (r.status === 401 && authEnabled && path !== '/auth/login' && path !== '/auth/status') {
    clearAuth();
    showLoginOverlay();
    throw new Error('Session expired');
  }
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || r.statusText);
  }
  const text = await r.text();
  if (!text) return null;
  return JSON.parse(text);
}

/**
 * Establish a WebSocket connection for real-time timecode + cue updates.
 * Automatically reconnects on close.
 */
function connectWS() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const tokenParam = authToken ? `?token=${encodeURIComponent(authToken)}` : '';
  ws = new WebSocket(`${proto}//${location.host}/ws${tokenParam}`);

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
      if (!data || typeof data.timecode !== 'string') return;
      DOM.tcValue.textContent = data.timecode;
      DOM.tcState.textContent = (data.status || 'stopped').toUpperCase();
      DOM.tcState.className = data.status || 'stopped';
      DOM.tcFps.textContent = `${data.frame_rate || '?'} fps`;
      if (Array.isArray(data.cues)) renderFlowCues(data.cues);
    } catch (e) {
      // Silently ignore malformed WS messages
    }
  };
}
