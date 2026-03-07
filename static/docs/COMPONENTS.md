# ShowPulse Component Reference

## Shell Components

### TopNav
- **Visual**: Fixed top bar with three sections: tabs (left) | show name (center) | connection dot + user info (right)
- **HTML**: `<nav class="topnav">` with `.tabs`, `.show-name-label`, `.nav-right`
- **JS**: View switching in `ui-helpers.js`; WS dot toggled in `api.js`; role-based tab gating in `auth.js`
- **CSS**: `shell.css`
- **State**: Active tab tracked via `.active` class; `authRole` for tab visibility

### DisconnectBanner
- **Visual**: Red pulsing banner below TopNav when WebSocket drops
- **HTML**: `<div id="disconnect-banner">`
- **JS**: Toggled in `connectWS()` via `ws.onopen`/`ws.onclose` in `api.js`
- **CSS**: `shell.css` -- `.disconnect-banner.visible`
- **State**: Visibility tied to `wsConnected`

### LoadingOverlay
- **Visual**: Full-screen spinner shown during init, fades out
- **HTML**: `<div id="loading-overlay">`
- **JS**: Hidden at end of `init()` in `ui-helpers.js`
- **CSS**: `shell.css` -- `.loading-overlay.hidden`

### LoginOverlay
- **Visual**: Full-screen login form with name + PIN fields (z-index 310, above loading spinner)
- **HTML**: `<div id="login-overlay">`
- **JS**: `checkAuth()`, `doLogin()`, `doLogout()` in `auth.js`
- **CSS**: `shell.css`
- **State**: `authEnabled`, `authToken`, `authRole`, `authName`, `authDepts`

### ToastContainer
- **Visual**: Stack of notification toasts in bottom-right corner
- **HTML**: `<div id="toast-container">`
- **JS**: `showToast(message, type, duration)` in `ui-helpers.js`
- **CSS**: `shell.css` -- `.toast.success`, `.toast.error`, `.toast.info`
- **State**: No persistent state; toasts auto-remove

## Show View Components

### Sidebar
- **Visual**: Slide-out panel on left with dept filters, options, shortcuts
- **HTML**: `<aside id="show-sidebar">`
- **JS**: `toggleSidebar()` in `show.js`; dept filter rendering in `show.js`
- **CSS**: `show.css` -- `.show-sidebar.open`
- **State**: `sidebarOpen` (persisted to localStorage), `activeDeptFilters`

### FlowArea
- **Visual**: Main vertical column -- timer at top, scrollable cue list below
- **HTML**: `<div class="flow-area">`
- **CSS**: `show.css` -- flex column, `height: 100%`, `position: relative` (anchor for floating controls)
- **Layout**: Timer is `flex-shrink: 0` (fixed height), cue list is `flex: 1; overflow-y: auto` (scrolls independently)

### TimecodeDisplay
- **Visual**: Large TC digits with source label, transport buttons, goto field. Fixed at top of flow area.
- **HTML**: `<div id="flow-timecode">` with `.tc-row` and `.tc-controls`
- **JS**: Updated by WS messages in `api.js`; transport in `show.js`
- **CSS**: `show.css` -- `.flow-timecode`, `.tc-btn`, `.tc-btn.active`
- **State**: `DOM.tcValue`, `DOM.tcState`, `DOM.tcFps`
- **Role gating**: Transport controls hidden for roles below Manager (`auth.js:applyRole()`)

### FloatingControls
- **Visual**: Semi-transparent pill at bottom-right of flow area with backdrop blur
- **HTML**: `<div class="flow-controls" id="flow-controls">`
- **JS**: `toggleAutoPulse()`, `jumpToCurrent()`, `collapseAllActs()`, `expandAllActs()` in `show.js`
- **CSS**: `show.css` -- `.flow-controls`, `.fc-btn`, `.fc-btn.active`, `.fc-sep`
- **Buttons**: Now (jump to current, `C` key), Auto (auto-scroll toggle, `A` key), Collapse All, Expand All

### CueList
- **Visual**: Scrollable list of FlowCards grouped by act with collapsible dividers
- **HTML**: `<div id="flow-upcoming">`
- **JS**: `diffCueListWithActs()` in `show.js` (DOM-diffed), sorted by `trigger_tc`; `autoScrollCueList()` called after each render
- **CSS**: `show.css` -- `.flow-upcoming` with `flex: 1; overflow-y: auto`
- **Act grouping**: `.act-group` wrappers with `.act-header` dividers (line + inline text). Double-click header to collapse/expand
- **AutoPulse scroll**: When enabled, `autoScrollCueList()` runs at 10Hz to keep the warm cue at the top via `scrollTop` + `getBoundingClientRect()`

### FlowCard
- **Visual**: Cue card with dept-bar, label, TC, countdown, dept-dot, progress bar
- **HTML**: Created dynamically via `createFlowCard()` in `show.js`
- **JS**: `createFlowCard()`, `updateFlowCard()`, `updateWarningRow()`, `clearWarningRow()`, `updateProgressBar()` in `show.js`
- **CSS**: `show.css` -- `.flow-card` with tier classes
- **Tiers**: `.tier-active` (dimmed text, dept color vivid), `.tier-warning` (pulse + easing animation), `.tier-near`, `.tier-far` (dim text), `.tier-distant` (very dim text), `.tier-passed` (faded text)
- **Per-element opacity**: Text/countdown elements dimmed per-tier, but dept-bar and dept-dot stay at full brightness
- **Inline countdown**: Warning/go cues expand with `.card-countdown-row` showing READY/3/2/1/GO! text with traffic-light colors. Slides open with `max-height`/`opacity`/`padding-top` transitions. Digit pop/shake animations and GO flash on the card
- **Always-visible countdown**: T- countdown shown during warning/go states; T+ elapsed time shown for passed/active cues
- **Progress bar**: Fills 0% -> 100% with traffic-light color matching countdown state
- **Interaction**: Click to load trigger TC into goto field

## Manage View Components

### DeptPanel
- **Visual**: List of departments with color swatch, name, edit/delete buttons
- **HTML**: `<div id="dept-list">`
- **JS**: `renderDeptList()`, `openDeptModal()`, `deleteDept()` in `manage.js`
- **CSS**: `manage.css` -- `.dept-item`

### ActPanel
- **Visual**: List of acts with cue count, edit/delete buttons
- **HTML**: `<div id="act-list">`
- **JS**: `renderActList()`, `openActModal()`, `deleteAct()` in `manage.js`
- **CSS**: `manage.css` -- `.dept-item` (reused)

### CueTable
- **Visual**: Sortable table with department filter dropdown, import button
- **HTML**: `<table class="cue-table">` with `<tbody id="cue-table-body">`
- **JS**: `renderCueTable()`, `sortCueTable()` in `manage.js`
- **CSS**: `manage.css` -- `.cue-table`, `.sortable`
- **State**: `cueTableSort`

## Settings View Components

### TimecodeSettings
- **Visual**: Source radio buttons, device selects, generator config
- **HTML**: First `.panel` in `#view-settings`
- **JS**: `setSource()`, `refreshDeviceList()`, `updateGenConfig()` in `settings.js`
- **CSS**: `settings.css` -- `.radio-group`, `.setting-group`

### ShowNameSettings
- **Visual**: Text input for show name with save button
- **HTML**: In Settings panel
- **JS**: `saveShowName()` in `manage.js`
- **State**: `showName`

### AppearanceSettings
- **Visual**: Color pickers, TC size slider
- **HTML**: Second `.panel` in `#view-settings`
- **JS**: `setThemeColor()` in `settings.js`
- **CSS**: `settings.css` -- `.color-row`, `.slider-row`

### DataActions
- **Visual**: Export/Import buttons
- **HTML**: Third `.panel` in `#view-settings`
- **JS**: `exportShow()`, `importShow()` in `import-export.js`
- **CSS**: `settings.css` -- `.data-actions`

### DashboardPanel (Admin only)
- **Visual**: Live summary of connected users with name, role, duration, and timer lock status
- **HTML**: `<div id="dashboard-panel">`
- **JS**: `loadDashboard()`, `renderDashboard()`, `startDashboardPolling()`, `stopDashboardPolling()` in `auth.js`
- **CSS**: `settings.css` -- `.dash-summary`, `.dash-table`, `.dash-lock-holder`
- **State**: Auto-refreshes every 10 seconds while Settings view is active; polling stops when switching away
- **API**: `GET /api/admin/dashboard`

### UserPanel (Admin only)
- **Visual**: User list with add/edit/delete, role + department assignment
- **HTML**: `<div id="user-panel">`
- **JS**: `renderUserList()`, `openUserModal()`, `saveUser()`, `deleteUser()` in `auth.js`
- **CSS**: `settings.css`

### TimerLockUI
- **Visual**: "Take Control" / "Release" button for Managers
- **HTML**: `<button id="timer-lock-btn">`
- **JS**: `acquireTimerLock()`, `releaseTimerLock()`, `updateTimerLockUI()` in `auth.js`
- **State**: `hasTimerLock`

## Modal Components

### DeptModal
- **Visual**: Form with name + color inputs
- **HTML**: `<div id="dept-modal">`
- **JS**: `openDeptModal()`, `saveDept()` in `manage.js`
- **CSS**: `modals.css`

### CueModal
- **Visual**: Form with number, label, dept, act, TC, warn time, notes
- **HTML**: `<div id="cue-modal">`
- **JS**: `openCueModal()`, `saveCue()` in `manage.js`
- **CSS**: `modals.css`
- **Note**: Includes act selector dropdown

### ActModal
- **Visual**: Form with name + sort order inputs
- **HTML**: `<div id="act-modal">`
- **JS**: `openActModal()`, `saveAct()` in `manage.js`
- **CSS**: `modals.css`

### UserModal (Admin only)
- **Visual**: Form with name, PIN, role selector, department checkboxes
- **HTML**: `<div id="user-modal">`
- **JS**: `openUserModal()`, `saveUser()` in `auth.js`
- **CSS**: `modals.css`

### ConfirmModal
- **Visual**: Confirmation dialog with cancel/delete buttons
- **HTML**: `<div id="confirm-modal">`
- **JS**: `showConfirm()`, `closeConfirm()` in `ui-helpers.js`
- **CSS**: `modals.css` -- `.btn-danger`
- **Pattern**: Returns a Promise resolved by button click
