/* ══════════════════════════════════════════
   i18n.js — Internationalization & RTL support
   ══════════════════════════════════════════
   Provides t(key, params) for all user-facing strings.
   Loads language JSON dictionaries from /lang/*.json.
   Persists language choice to localStorage.
   Sets document dir="rtl"/"ltr" based on language.
   Loaded after state.js, before all other modules.
   ══════════════════════════════════════════ */

/** @type {string} Current language code. */
let currentLang = localStorage.getItem('showpulse-lang') || 'en';

/** @type {Object} Current language dictionary (flat key→string map). */
let langDict = {};

/** @type {Object} English fallback dictionary. */
let langFallback = {};

/** Languages that use RTL layout. */
const RTL_LANGS = new Set(['he', 'ar']);

/**
 * Translate a key with optional parameter substitution.
 * @param {string} key - Dot-separated key (e.g. "nav.show").
 * @param {Object} [params] - Substitution values (e.g. {name: "John"}).
 * @returns {string} Translated string, or the key itself if not found.
 */
function t(key, params) {
  let str = langDict[key] || langFallback[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), v);
    }
  }
  return str;
}

/**
 * Apply data-i18n attributes to all matching DOM elements.
 * Supports: data-i18n (textContent), data-i18n-placeholder, data-i18n-title.
 */
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) el.placeholder = t(key);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (key) el.title = t(key);
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    if (key) el.innerHTML = t(key);
  });
}

/**
 * Load a language dictionary from /lang/{code}.json.
 * @param {string} code - Language code (e.g. "en", "he").
 * @returns {Promise<Object>} The parsed dictionary.
 */
async function loadLangDict(code) {
  try {
    const resp = await fetch(`/lang/${code}.json`);
    if (!resp.ok) throw new Error(resp.statusText);
    return await resp.json();
  } catch (e) {
    console.warn(`i18n: failed to load /lang/${code}.json`, e);
    return {};
  }
}

/**
 * Switch to a new language. Updates DOM direction, re-applies translations.
 * @param {string} code - Language code.
 */
async function setLang(code) {
  currentLang = code;
  localStorage.setItem('showpulse-lang', code);

  langDict = await loadLangDict(code);

  // Set document direction
  const isRTL = RTL_LANGS.has(code);
  document.documentElement.lang = code;
  document.documentElement.dir = isRTL ? 'rtl' : 'ltr';

  // Apply static translations
  applyI18n();

  // Update language selector if present
  const sel = document.getElementById('lang-select');
  if (sel) sel.value = code;
}

/**
 * Initialize i18n. Load English fallback + current language.
 * Called once before app init.
 */
async function initI18n() {
  // Always load English as fallback
  langFallback = await loadLangDict('en');

  if (currentLang === 'en') {
    langDict = langFallback;
  } else {
    langDict = await loadLangDict(currentLang);
  }

  // Set document direction
  const isRTL = RTL_LANGS.has(currentLang);
  document.documentElement.lang = currentLang;
  document.documentElement.dir = isRTL ? 'rtl' : 'ltr';

  // Apply static translations
  applyI18n();
}
