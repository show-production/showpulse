# ShowPulse Component Reference

## Shell Components

### TopNav
- **Visual**: Fixed top bar with Show/Manage/Settings tabs and brand logo with WS status dot
- **HTML**: `<nav class="topnav">` with `.tabs` and `.brand`
- **JS**: View switching in `ui-helpers.js`; WS dot toggled in `api.js`
- **CSS**: `shell.css`
- **State**: Active tab tracked via `.active` class

### DisconnectBanner
- **Visual**: Red pulsing banner below TopNav when WebSocket drops
- **HTML**: `<div id="disconnect-banner">`
- **JS**: Toggled in `connectWS()` via `ws.onopen`/`ws.onclose` in `api.js`
- **CSS**: `shell.css` — `.disconnect-banner.visible`
- **State**: Visibility tied to `wsConnected`

### LoadingOverlay
- **Visual**: Full-screen spinner shown during init, fades out
- **HTML**: `<div id="loading-overlay">`
- **JS**: Hidden at end of `init()` in `ui-helpers.js`
- **CSS**: `shell.css` — `.loading-overlay.hidden`

### ToastContainer
- **Visual**: Stack of notification toasts in bottom-right corner
- **HTML**: `<div id="toast-container">`
- **JS**: `showToast(message, type, duration)` in `ui-helpers.js`
- **CSS**: `shell.css` — `.toast.success`, `.toast.error`, `.toast.info`
- **State**: No persistent state; toasts auto-remove

## Show View Components

### Sidebar
- **Visual**: Slide-out panel on left with dept filters, options, shortcuts
- **HTML**: `<aside id="show-sidebar">`
- **JS**: `toggleSidebar()` in `show.js`; dept filter rendering in `show.js`
- **CSS**: `show.css` — `.show-sidebar.open`
- **State**: `sidebarOpen` (persisted to localStorage), `activeDeptFilters`

### FlowArea
- **Visual**: Main vertical column — timer at top, scrollable cue list below
- **HTML**: `<div class="flow-area">`
- **CSS**: `show.css` — flex column, `height: 100%`
- **Layout**: Timer is `flex-shrink: 0` (fixed height), cue list is `flex: 1; overflow-y: auto` (scrolls independently)

### TimecodeDisplay
- **Visual**: Large TC digits with source label, transport buttons, goto field, AutoPulse + Jump buttons. Fixed at top of flow area.
- **HTML**: `<div id="flow-timecode">` with `.tc-row` and `.tc-controls`
- **JS**: Updated by WS messages in `api.js`; transport in `show.js`
- **CSS**: `show.css` — `.flow-timecode`, `.tc-btn`, `.tc-btn.active`
- **State**: `DOM.tcValue`, `DOM.tcState`, `DOM.tcFps`
- **AutoPulse**: `Auto` button toggles auto-scroll (`A` key). When on, cue list tracks the warm cue (first warning/go, or first upcoming). User scroll blocked via wheel/touch event listeners. State persisted to localStorage.
- **Jump**: `⤇ Now` button smooth-scrolls to warm cue (`C` key). Works regardless of AutoPulse state.

### CueList
- **Visual**: Scrollable list of FlowCards — all cues in chronological order
- **HTML**: `<div id="flow-upcoming">`
- **JS**: `diffCueList()` in `show.js` (DOM-diffed), sorted by `trigger_tc`; `autoScrollCueList()` called after each render
- **CSS**: `show.css` — `.flow-upcoming` with `flex: 1; overflow-y: auto`
- **AutoPulse scroll**: When enabled, `autoScrollCueList()` runs at 10Hz to keep the warm cue at the top via `scrollTop` + `getBoundingClientRect()`

### FlowCard
- **Visual**: Cue card with dept-bar, label, TC, countdown, progress bar
- **HTML**: Created dynamically via `createFlowCard()` in `show.js`
- **JS**: `createFlowCard()`, `updateFlowCard()`, `getTrafficLight()` in `show.js`
- **CSS**: `show.css` — `.flow-card` with tier classes
- **Tiers**: `.tier-active` (glow), `.tier-warning` (pulse), `.tier-near`, `.tier-far` (dim), `.tier-distant` (very dim), `.tier-passed` (faded)
- **Inline countdown**: Warning/go cues expand with `.card-countdown-row` showing READY/3/2/1/GO! text with traffic-light colors (red → orange → yellow → green). Includes digit pop/shake animations and GO flash on the card.
- **Progress bar**: Fills 0% → 100% with traffic-light color matching countdown state
- **Interaction**: Click to load trigger TC into goto field

## Manage View Components

### DeptPanel
- **Visual**: List of departments with color swatch, name, edit/delete buttons
- **HTML**: `<div id="dept-list">`
- **JS**: `renderDeptList()`, `openDeptModal()`, `deleteDept()` in `manage.js`
- **CSS**: `manage.css` — `.dept-item`

### CueTable
- **Visual**: Sortable table with filter dropdown, import button
- **HTML**: `<table class="cue-table">` with `<tbody id="cue-table-body">`
- **JS**: `renderCueTable()`, `sortCueTable()` in `manage.js`
- **CSS**: `manage.css` — `.cue-table`, `.sortable`
- **State**: `cueTableSort`

## Settings View Components

### TimecodeSettings
- **Visual**: Source radio buttons, device selects, generator config
- **HTML**: First `.panel` in `#view-settings`
- **JS**: `setSource()`, `refreshDeviceList()`, `updateGenConfig()` in `settings.js`
- **CSS**: `settings.css` — `.radio-group`, `.setting-group`

### AppearanceSettings
- **Visual**: Color pickers, TC size slider
- **HTML**: Second `.panel` in `#view-settings`
- **JS**: `setThemeColor()` in `settings.js`
- **CSS**: `settings.css` — `.color-row`, `.slider-row`

### DataActions
- **Visual**: Export/Import buttons
- **HTML**: Third `.panel` in `#view-settings`
- **JS**: `exportShow()`, `importShow()` in `import-export.js`
- **CSS**: `settings.css` — `.data-actions`

## Modal Components

### DeptModal
- **Visual**: Form with name + color inputs
- **HTML**: `<div id="dept-modal">`
- **JS**: `openDeptModal()`, `saveDept()` in `manage.js`
- **CSS**: `modals.css`

### CueModal
- **Visual**: Form with number, label, dept, TC, warn time, notes
- **HTML**: `<div id="cue-modal">`
- **JS**: `openCueModal()`, `saveCue()` in `manage.js`
- **CSS**: `modals.css`

### ConfirmModal
- **Visual**: Confirmation dialog with cancel/delete buttons
- **HTML**: `<div id="confirm-modal">`
- **JS**: `showConfirm()`, `closeConfirm()` in `ui-helpers.js`
- **CSS**: `modals.css` — `.btn-danger`
- **Pattern**: Returns a Promise resolved by button click
