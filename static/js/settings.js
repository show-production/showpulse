/* ══════════════════════════════════════════
   settings.js — SettingsView: source, devices, generator, theme
   ══════════════════════════════════════════
   Handles timecode source selection, LTC/MTC device management,
   generator configuration, and theme/appearance settings.
   Dependencies: state.js, api.js, ui-helpers.js (showToast)
   Components: TimecodeSettings, AppearanceSettings
   ══════════════════════════════════════════ */

// ── Source selection ───────────────────────

/**
 * Set the active timecode source and update UI accordingly.
 * @param {string} source - Source name ("generator", "ltc", or "mtc").
 * @param {HTMLElement} [el] - The clicked radio label element.
 */
async function setSource(source, el) {
  try {
    await api('/timecode/source', { method: 'PUT', body: { source } });
  } catch (e) {
    showToast(t('settings.sourceFailed', { msg: e.message }), 'error');
  }
  DOM.tcSource.textContent = source.charAt(0).toUpperCase() + source.slice(1);
  // Update radio visual
  document.querySelectorAll('#source-radio label').forEach(l => l.classList.remove('selected'));
  if (el) el.classList.add('selected');
  // Show/hide device selectors
  const ltcGroup = document.getElementById('ltc-device-group');
  const mtcGroup = document.getElementById('mtc-device-group');
  ltcGroup.classList.toggle('hidden', source !== 'ltc');
  mtcGroup.classList.toggle('hidden', source !== 'mtc');
  if (source === 'ltc') refreshLtcDevices();
  if (source === 'mtc') refreshMtcDevices();
}

// ── Device refresh (generic) ───────────────

/**
 * Refresh a device/port list dropdown.
 * @param {string} endpoint - API path (e.g. "/ltc/devices").
 * @param {string} selectId - DOM id of the <select>.
 * @param {string} statusId - DOM id of the status text element.
 * @param {string} placeholder - Default option text.
 * @param {string} deviceLabel - "device" or "port" for status text.
 */
async function refreshDeviceList(endpoint, selectId, statusId, placeholder, deviceLabel) {
  const select = document.getElementById(selectId);
  const statusEl = document.getElementById(statusId);
  try {
    const items = await api(endpoint);
    select.innerHTML = `<option value="">${placeholder}</option>`;
    if (items && items.length > 0) {
      items.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.index;
        opt.textContent = item.name;
        select.appendChild(opt);
      });
      statusEl.textContent = t('settings.devicesFound', { count: items.length });
    } else {
      statusEl.textContent = t('settings.noDevices');
    }
  } catch (e) {
    statusEl.textContent = t('settings.devicesError');
  }
}

/**
 * Refresh the LTC audio device list.
 */
function refreshLtcDevices() {
  return refreshDeviceList('/ltc/devices', 'ltc-device-select', 'ltc-status', '-- Select audio device --', 'device');
}

/**
 * Refresh the MTC MIDI port list.
 */
function refreshMtcDevices() {
  return refreshDeviceList('/mtc/devices', 'mtc-device-select', 'mtc-status', '-- Select MIDI port --', 'port');
}

// ── Device selection ───────────────────────

/**
 * Select an LTC audio device or stop LTC if deselected.
 */
async function selectLtcDevice() {
  const select = document.getElementById('ltc-device-select');
  const statusEl = document.getElementById('ltc-status');
  const idx = select.value;
  if (idx === '') {
    await api('/ltc/stop', { method: 'POST' });
    statusEl.textContent = t('settings.ltcStopped');
    return;
  }
  try {
    await api('/ltc/device', { method: 'PUT', body: { device_index: parseInt(idx) } });
    statusEl.textContent = t('settings.listening', { device: select.options[select.selectedIndex].text });
    statusEl.style.color = 'var(--accent)';
  } catch (e) {
    statusEl.textContent = t('settings.deviceOpenFailed');
    statusEl.style.color = 'var(--danger, #ff4444)';
  }
}

/**
 * Select an MTC MIDI port or stop MTC if deselected.
 */
async function selectMtcDevice() {
  const select = document.getElementById('mtc-device-select');
  const statusEl = document.getElementById('mtc-status');
  const idx = select.value;
  if (idx === '') {
    await api('/mtc/stop', { method: 'POST' });
    statusEl.textContent = t('settings.mtcStopped');
    return;
  }
  try {
    await api('/mtc/device', { method: 'PUT', body: { port_index: parseInt(idx) } });
    statusEl.textContent = t('settings.listening', { device: select.options[select.selectedIndex].text });
    statusEl.style.color = 'var(--accent)';
  } catch (e) {
    statusEl.textContent = t('settings.midiOpenFailed');
    statusEl.style.color = 'var(--danger, #ff4444)';
  }
}

// ── Generator config ───────────────────────

/**
 * Update generator configuration from the settings form fields.
 */
async function updateGenConfig() {
  const fps = document.getElementById('set-fps').value;
  const mode = document.getElementById('set-mode').value;
  const startTC = parseTC(document.getElementById('set-start-tc').value);
  const speed = parseFloat(document.getElementById('set-speed').value) || 1.0;

  try {
    await api('/generator', {
      method: 'PUT',
      body: {
        mode,
        frame_rate: fps,
        start_tc: startTC,
        loop_in: null,
        loop_out: null,
        speed,
      }
    });
  } catch (e) {
    showToast(t('settings.configFailed', { msg: e.message }), 'error');
  }
}

// ── Theme / Appearance ─────────────────────

/**
 * Switch between dark and light themes.
 * @param {string} mode - "dark" or "light".
 * @param {HTMLElement} [el] - The clicked radio label element.
 */
function setTheme(mode, el) {
  if (mode === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  localStorage.setItem('showpulse-theme-mode', mode);
  // Update radio visual
  document.querySelectorAll('#theme-radio label').forEach(l => l.classList.remove('selected'));
  if (el) el.classList.add('selected');
}

/**
 * Set a CSS custom property and persist to localStorage.
 * @param {string} varName - CSS variable name (e.g. "--accent").
 * @param {string} value - New value.
 */
function setThemeColor(varName, value) {
  document.documentElement.style.setProperty(varName, value);
  const theme = JSON.parse(localStorage.getItem('showpulse-theme') || '{}');
  theme[varName] = value;
  localStorage.setItem('showpulse-theme', JSON.stringify(theme));
}

/**
 * Load saved theme overrides from localStorage.
 */
function loadTheme() {
  // Restore dark/light mode
  const mode = localStorage.getItem('showpulse-theme-mode') || 'dark';
  if (mode === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  }
  // Sync radio button state
  const radio = document.getElementById(`theme-${mode}`);
  if (radio) {
    radio.checked = true;
    document.querySelectorAll('#theme-radio label').forEach(l => l.classList.remove('selected'));
    const label = radio.nextElementSibling;
    if (label) label.classList.add('selected');
  }
  // Restore per-variable overrides
  const theme = JSON.parse(localStorage.getItem('showpulse-theme') || '{}');
  for (const [k, v] of Object.entries(theme)) {
    document.documentElement.style.setProperty(k, v);
  }
}
