# ShowPulse Frontend Guide

## File Structure

| File | Purpose | ~Lines |
|------|---------|--------|
| `index.html` | Skeleton HTML (markup only) | 280 |
| `css/variables.css` | CSS custom properties (design tokens) | 55 |
| `css/base.css` | Reset, shared patterns (.dot, .dept-bar), utilities | 65 |
| `css/shell.css` | TopNav, DisconnectBanner, LoadingOverlay, Toast | 110 |
| `css/show.css` | Sidebar, FlowArea, all flow components, FlowCard tiers | 370 |
| `css/manage.css` | Panel, DeptPanel, CueTable, icon buttons | 115 |
| `css/settings.css` | Settings grid, groups, radio, slider, speed | 110 |
| `css/modals.css` | Modal overlay, dialog, form groups, confirm | 90 |
| `js/state.js` | CONST, global state, DOM cache, shared helpers | 190 |
| `js/api.js` | api() wrapper, connectWS() | 55 |
| `js/show.js` | ShowView rendering, sidebar, transport, navigation | 380 |
| `js/manage.js` | CRUD, table render, dept list, sort | 240 |
| `js/settings.js` | Source, device refresh, generator, theme | 175 |
| `js/import-export.js` | Show export/import, CSV parsing, cue import | 140 |
| `js/ui-helpers.js` | Toasts, modals, keyboard, view switching, init | 120 |

## Component Terminology

| Component | ID / Class | Location |
|-----------|-----------|----------|
| TopNav | `.topnav` | shell.css |
| DisconnectBanner | `#disconnect-banner` | shell.css |
| LoadingOverlay | `#loading-overlay` | shell.css |
| ToastContainer | `#toast-container` | shell.css |
| Sidebar | `#show-sidebar` | show.css |
| FlowArea | `.flow-area` | show.css |
| PassedBadge | `#flow-passed` | show.css |
| ActiveStrips | `#flow-triggered` | show.css |
| TimecodeDisplay | `#flow-timecode` | show.css |
| ReadyGoZone | `#flow-readygo` | show.css |
| UpcomingList | `#flow-upcoming` | show.css |
| FlowCard | `.flow-card` | show.css |
| DeptPanel | `#dept-list` | manage.css |
| CueTable | `.cue-table` | manage.css |
| DeptModal | `#dept-modal` | modals.css |
| CueModal | `#cue-modal` | modals.css |
| ConfirmModal | `#confirm-modal` | modals.css |

## Coding Standards

### JavaScript
- **Async/await** everywhere (no `.then()` chains)
- **Template literals** for all string building (no `+` concatenation for HTML)
- **try/catch + showToast()** on every API call
- **JSDoc** on every function with `@param`, `@returns`
- **CONST** object for all magic values (no hardcoded strings/numbers)
- **DOM cache** for frequently-accessed elements (`DOM.tcValue`, etc.)
- **formatCueLabel()** for cue label formatting (never inline)

### CSS
- **CSS custom properties** for all repeated values (colors, sizes, spacing)
- **No inline styles** in HTML — use utility classes
- **Shared base classes** for repeated patterns (`.dot`, `.dept-bar`, `.scrollbar-thin`)
- **No redundant `font-family`** declarations (inherited from body)
- **Section markers** (`/* ── ComponentName ── */`) within files
- **File headers** with module name, dependencies, and components

### HTML
- No `<style>` or `<script>` blocks — external files only
- `class="hidden"` instead of `style="display:none"`
- Utility classes for common inline patterns

## How to Add a New Component

1. **CSS**: Add styles in the appropriate CSS file with a section marker
2. **HTML**: Add markup in `index.html` in the correct view container
3. **JS**: Add rendering/interaction functions in the appropriate JS file
4. **State**: Add any new global state to `state.js`
5. **DOM cache**: Add frequently-used elements to `initDOM()` in `state.js`

## How to Add a New View

1. Add a `<button class="tab" data-view="viewname">` to the TopNav
2. Add a `<div class="view" id="view-viewname">` container in `index.html`
3. Create a new JS file for the view's logic
4. Add a `<script src="js/viewname.js">` tag (before `ui-helpers.js`)
5. The view switching in `ui-helpers.js` auto-handles the new tab

## Load Order

Scripts are synchronous `<script>` tags (no modules, no build step):

```
state.js → api.js → show.js → manage.js → settings.js → import-export.js → ui-helpers.js
```

`state.js` must be first (defines globals). `ui-helpers.js` must be last (runs `init()`).

## CSS Architecture

```
variables.css  → Design tokens (:root custom properties)
base.css       → Reset + shared patterns + utilities
shell.css      → App-level chrome (nav, overlays, toasts)
show.css       → Show view (largest file)
manage.css     → Manage view + shared panel component
settings.css   → Settings view
modals.css     → All modal dialogs + form groups
```

Link order in `<head>` matches this — specificity is preserved.
