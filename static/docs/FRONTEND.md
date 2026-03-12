# ShowPulse Frontend Guide

## File Structure

| File | Purpose | ~Lines |
|------|---------|--------|
| `index.html` | Skeleton HTML (markup only) | 579 |
| `css/variables.css` | CSS custom properties (design tokens) | 85 |
| `css/base.css` | Reset, shared patterns (.dot, .dept-bar), utilities | 84 |
| `css/shell.css` | TopNav, DisconnectBanner, LoginOverlay, LoadingOverlay, Toast, branding logos | 264 |
| `css/show.css` | Sidebar, FlowArea, FlowControls, FlowCard tiers, act headers | 616 |
| `css/manage.css` | Panel, DeptPanel, ActPanel, CueList, timeline strip, bulk ops, inline edit | 482 |
| `css/settings.css` | Settings grid, groups, radio, slider, speed, user panel, dashboard | 295 |
| `css/modals.css` | Modal overlay, dialog, form groups, confirm | 249 |
| `js/state.js` | CONST, global state, DOM cache, shared helpers, CRUD helpers | 344 |
| `js/i18n.js` | i18n engine: t() lookup, setLanguage(), applyLanguage(), EN/HE dictionaries | 785 |
| `js/api.js` | api() wrapper, connectWS(), WS message validation | 95 |
| `js/auth.js` | Login, role gating, user CRUD, timer lock UI, dashboard | 532 |
| `js/show.js` | ShowView rendering, sidebar, transport, AutoPulse, act grouping | 659 |
| `js/manage.js` | Editor: act-grouped cue list, drag-drop, inline edit, multi-select, bulk ops | 1051 |
| `js/timeline.js` | Timeline editor: zoom/pan, scrub, minimap, tooltips, selection sync | 374 |
| `js/settings.js` | Source, device refresh, generator, theme | 209 |
| `js/import-export.js` | Show export/import, CSV parsing, cue import, analytical print report | 711 |
| `js/ui-helpers.js` | Toasts, modals, keyboard, view switching, init | 273 |

## Component Terminology

| Component | ID / Class | Location |
|-----------|-----------|----------|
| TopNav | `.topnav` | shell.css |
| DisconnectBanner | `#disconnect-banner` | shell.css |
| LoginOverlay | `#login-overlay` | shell.css |
| LoadingOverlay | `#loading-overlay` | shell.css |
| ToastContainer | `#toast-container` | shell.css |
| Sidebar | `#show-sidebar` | show.css |
| FlowArea | `.flow-area` | show.css |
| TimecodeDisplay | `#flow-timecode` | show.css |
| FlowControls | `#flow-controls` | show.css |
| CueList | `#flow-upcoming` | show.css |
| FlowCard | `.flow-card` | show.css |
| ActHeader | `.act-header` | show.css |
| DeptPanel | `#dept-list` | manage.css |
| ActPanel | `#act-list` | manage.css |
| Editor (CueList) | `#cue-list-body` | manage.css |
| DeptModal | `#dept-modal` | modals.css |
| CueModal | `#cue-modal` | modals.css |
| ActModal | `#act-modal` | modals.css |
| UserModal | `#user-modal` | modals.css |
| ConfirmModal | `#confirm-modal` | modals.css |
| UserPanel | `#user-panel` | settings.css |
| TimerLock | `#timer-lock-btn` | shell.css |

## Coding Standards

### JavaScript
- **Async/await** everywhere (no `.then()` chains)
- **Template literals** for all string building (no `+` concatenation for HTML)
- **try/catch + showToast()** on every API call
- **JSDoc** on every function with `@param`, `@returns`
- **CONST** object for all magic values (no hardcoded strings/numbers)
- **DOM cache** for frequently-accessed elements (`DOM.tcValue`, etc.)
- **formatCueLabel()** for cue label formatting (never inline)
- **apiSave() / apiDelete()** for CRUD operations (generic helpers in `state.js`)

### CSS
- **CSS custom properties** for all repeated values (colors, sizes, spacing)
- **No inline styles** in HTML -- use utility classes
- **Shared base classes** for repeated patterns (`.dot`, `.dept-bar`, `.scrollbar-thin`)
- **No redundant `font-family`** declarations (inherited from body)
- **Section markers** (`/* -- ComponentName -- */`) within files
- **File headers** with module name, dependencies, and components

### HTML
- No `<style>` or `<script>` blocks -- external files only
- `class="hidden"` instead of `style="display:none"`
- Utility classes for common inline patterns

## How to Add a New Component

1. **CSS**: Add styles in the appropriate CSS file with a section marker
2. **HTML**: Add markup in `index.html` in the correct view container
3. **JS**: Add rendering/interaction functions in the appropriate JS file
4. **State**: Add any new global state to `state.js`
5. **DOM cache**: Add frequently-used elements to `initDOM()` in `state.js`
6. **CRUD**: Use `apiSave()` / `apiDelete()` from `state.js` for save/delete patterns

## How to Add a New View

1. Add a `<button class="tab" data-view="viewname">` to the TopNav
2. Add a `<div class="view" id="view-viewname">` container in `index.html`
3. Create a new JS file for the view's logic
4. Add a `<script src="js/viewname.js">` tag (before `ui-helpers.js`)
5. Update role gating in `auth.js:applyRole()` if the view is restricted
6. The view switching in `ui-helpers.js` auto-handles the new tab

## Load Order

Scripts are synchronous `<script>` tags (no modules, no build step):

```
state.js -> i18n.js -> api.js -> auth.js -> show.js -> manage.js -> timeline.js -> settings.js -> import-export.js -> ui-helpers.js
```

`state.js` must be first (defines globals). `auth.js` must be before `show.js` (role checks). `ui-helpers.js` must be last (runs `init()`).

## CSS Architecture

```
variables.css  -> Design tokens (:root custom properties)
base.css       -> Reset + shared patterns + utilities
shell.css      -> App-level chrome (nav, overlays, toasts, login)
show.css       -> Show view (largest file)
manage.css     -> Manage view + shared panel component
settings.css   -> Settings view + user panel
modals.css     -> All modal dialogs + form groups
```

Link order in `<head>` matches this -- specificity is preserved.
