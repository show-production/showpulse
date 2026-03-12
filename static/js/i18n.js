/* ══════════════════════════════════════════
   i18n.js — Internationalization dictionary + helpers
   ══════════════════════════════════════════
   Loaded after state.js, before all other modules.
   Provides:
     I18N        — string dictionaries keyed by language code
     currentLang — active language ('en' | 'he')
     t(key, params) — translate a key with optional {param} interpolation
     setLanguage(lang) — switch language, set dir/lang, re-render
   ══════════════════════════════════════════ */

// ── Active language ─────────────────────────

/** @type {'en'|'he'} */
let currentLang = localStorage.getItem('showpulse-lang') || 'en';

// ── Dictionaries ────────────────────────────

const I18N = {

  // ─── English (default / complete) ──────────

  en: {
    // Nav
    'nav.show': 'Show',
    'nav.editor': 'Editor',
    'nav.settings': 'Settings',
    'nav.logout': 'Logout',

    // Banner
    'banner.disconnect': 'Connection Lost \u2014 Reconnecting\u2026',

    // Loading / Login
    'loading.text': 'ShowPulse',
    'login.heading': 'ShowPulse',
    'login.name': 'Name',
    'login.pin': 'PIN',
    'login.button': 'Login',
    'login.error.required': 'Name and PIN required',
    'login.error.invalid': 'Invalid name or PIN',
    'login.success': 'Welcome, {name}',

    // Timecode display
    'tc.stopped': 'STOPPED',
    'tc.running': 'RUNNING',
    'tc.fps': '{fps} fps',
    'tc.source.generator': 'Generator',
    'tc.source.ltc': 'LTC',
    'tc.source.mtc': 'MTC',

    // Transport tooltips
    'transport.prev': 'Previous cue (B)',
    'transport.play': 'Play (Space)',
    'transport.pause': 'Pause (P)',
    'transport.stop': 'Stop (Esc)',
    'transport.next': 'Next cue (N)',
    'transport.goto': 'Goto (G)',
    'transport.placeholder': 'HH:MM:SS:FF',
    'transport.gotoHint': 'Click a cue to go to',

    // Timer lock
    'timer.takeControl': 'Take Control',
    'timer.release': 'Release',
    'timer.locked': 'Locked',
    'timer.youHaveControl': 'You have control',
    'timer.hasControl': '{name} has control',
    'timer.acquired': 'Timer control acquired',
    'timer.conflict': 'Timer is locked by another manager',
    'timer.released': 'Timer control released',
    'timer.acquireFirst': 'Acquire timer control first',
    'timer.required': 'Timer control required',

    // Flow controls
    'flow.now': '\u2907 Now',
    'flow.auto': 'Auto',
    'flow.collapse': '\u25B4 Collapse',
    'flow.expand': '\u25BE Expand',
    'flow.nowTooltip': 'Jump to current (C)',
    'flow.autoTooltip': 'Auto-scroll (A)',
    'flow.collapseTooltip': 'Collapse all acts',
    'flow.expandTooltip': 'Expand all acts',

    // Sidebar
    'sidebar.toggle': 'Toggle sidebar (S)',
    'sidebar.departments': 'Departments',
    'sidebar.crew': 'Crew',
    'sidebar.shortcuts': 'Shortcuts',
    'sidebar.allDepts': 'All',

    // Keyboard shortcuts
    'shortcut.play': 'Play',
    'shortcut.pause': 'Pause',
    'shortcut.stop': 'Stop',
    'shortcut.nextCue': 'Next Cue',
    'shortcut.prevCue': 'Prev Cue',
    'shortcut.gotoTc': 'Goto TC',
    'shortcut.autoScroll': 'Auto-scroll',
    'shortcut.jumpCurrent': 'Jump to current',
    'shortcut.sidebar': 'Sidebar',

    // Show view cue states
    'cue.ready': 'READY',
    'cue.go': 'GO!',
    'cue.now': 'NOW',
    'cue.noCues': 'No cues yet. Go to Editor to add some.',
    'cue.noMatch': 'No matching cues.',

    // Editor panels
    'editor.departments': 'Departments',
    'editor.acts': 'Acts',
    'editor.cueList': 'Cue List',
    'editor.allDepts': 'All Departments',
    'editor.import': 'Import',
    'editor.importReplace': 'Replace all',
    'editor.importAppend': 'Append',
    'editor.exportJson': 'Export JSON',
    'editor.exportCsv': 'Export CSV',
    'editor.printReport': 'Print Report',
    'editor.add': '+ Add',

    // Editor empty states
    'editor.noDepts': 'No departments yet.',
    'editor.noActs': 'No acts yet.',
    'editor.noCues': 'No cues yet.',
    'editor.ungrouped': 'Ungrouped',

    // Editor cue list
    'editor.cue': 'cue',
    'editor.cues': 'cues',
    'editor.dragHint': 'Drag to reorder',
    'editor.duplicate': 'Duplicate',
    'editor.edit': 'Edit',
    'editor.delete': 'Delete',

    // Editor bulk bar
    'bulk.selected': '{count} selected',
    'bulk.moveTo': 'Move to\u2026',
    'bulk.duplicate': 'Duplicate',
    'bulk.arm': 'Arm',
    'bulk.disarm': 'Disarm',
    'bulk.delete': 'Delete',
    'bulk.clear': 'Clear selection',
    'bulk.moved': 'Moved {count} cues',
    'bulk.duplicated': 'Duplicated {count} cues',
    'bulk.deleted': 'Deleted {count} cues',
    'bulk.armed': 'Armed {count} cues',
    'bulk.disarmed': 'Disarmed {count} cues',
    'bulk.confirmDelete': 'Delete {count} selected cue(s)?',

    // Department modal
    'dept.add': 'Add Department',
    'dept.edit': 'Edit Department',
    'dept.name': 'Name',
    'dept.namePlaceholder': 'e.g. Lighting',
    'dept.color': 'Color',
    'dept.confirmDelete': 'Delete department and all its cues?',
    'dept.deleteTitle': 'Delete Department',

    // Cue modal
    'cueModal.add': 'Add Cue',
    'cueModal.edit': 'Edit Cue',
    'cueModal.label': 'Label',
    'cueModal.labelPlaceholder': 'e.g. House lights down',
    'cueModal.department': 'Department',
    'cueModal.act': 'Act',
    'cueModal.noAct': '\u2014 No Act \u2014',
    'cueModal.triggerTc': 'Trigger Timecode',
    'cueModal.warning': 'Warning',
    'cueModal.sec': 'sec',
    'cueModal.advanced': 'Advanced',
    'cueModal.cueNumber': 'Cue #',
    'cueModal.cueNumberPlaceholder': 'Auto',
    'cueModal.duration': 'Duration',
    'cueModal.armed': 'Armed',
    'cueModal.armedYes': 'Yes',
    'cueModal.armedNo': 'No',
    'cueModal.continueMode': 'Continue Mode',
    'cueModal.stop': 'Stop',
    'cueModal.autoContinue': 'Auto Continue',
    'cueModal.autoFollow': 'Auto Follow',
    'cueModal.postWait': 'Post Wait',
    'cueModal.notes': 'Notes',
    'cueModal.notesPlaceholder': 'Optional notes\u2026',
    'cueModal.saveAnother': 'Save & Add Another',
    'cueModal.deleteTitle': 'Delete Cue',
    'cueModal.confirmDelete': 'Delete this cue?',
    'cueModal.duplicated': 'Cue duplicated',
    'cueModal.duplicateFailed': 'Failed to duplicate cue',

    // Act modal
    'actModal.add': 'Add Act',
    'actModal.edit': 'Edit Act',
    'actModal.name': 'Name',
    'actModal.namePlaceholder': 'e.g. Act 1 \u2014 Opening',
    'actModal.sortOrder': 'Sort Order',
    'actModal.deleteTitle': 'Delete Act',
    'actModal.confirmDelete': 'Delete this act? Cues will be unassigned.',
    'actModal.duplicatePrompt': 'Time offset for duplicated cues (seconds):',
    'actModal.duplicated': 'Duplicated "{name}" with {count} cues',
    'actModal.duplicateFailed': 'Failed to duplicate act',

    // User modal
    'userModal.add': 'Add User',
    'userModal.edit': 'Edit User',
    'userModal.name': 'Name',
    'userModal.namePlaceholder': 'e.g. John',
    'userModal.pin': 'PIN',
    'userModal.pinPlaceholder': 'PIN',
    'userModal.pinKeep': 'Leave empty to keep current',
    'userModal.role': 'Role',
    'userModal.deptFilter': 'Departments (Viewer/Crew Lead filter)',
    'userModal.deleteTitle': 'Delete User',
    'userModal.confirmDelete': 'Delete user "{name}"?',
    'userModal.nameRequired': 'Name is required',
    'userModal.pinRequired': 'PIN is required for new users',

    // Roles
    'role.viewer': 'Viewer',
    'role.crew_lead': 'Crew Lead',
    'role.operator': 'Operator',
    'role.manager': 'Manager',
    'role.admin': 'Admin',

    // Entity names (for toast templates)
    'entity.department': 'Department',
    'entity.cue': 'Cue',
    'entity.act': 'Act',
    'entity.user': 'User',

    // Generic modal buttons
    'modal.cancel': 'Cancel',
    'modal.save': 'Save',
    'modal.delete': 'Delete',
    'modal.confirm': 'Confirm',

    // Settings panels
    'settings.users': 'Users',
    'settings.refresh': 'Refresh',
    'settings.addUser': '+ Add User',
    'settings.show': 'Show',
    'settings.showName': 'Show Name',
    'settings.showNamePlaceholder': 'My Show',
    'settings.save': 'Save',
    'settings.showNameUpdated': 'Show name updated',
    'settings.showNameFailed': 'Failed to update show name',

    // Timecode settings
    'settings.timecode': 'Timecode',
    'settings.source': 'Source',
    'settings.generator': 'Generator',
    'settings.ltc': 'LTC',
    'settings.mtc': 'MTC',
    'settings.audioDevice': 'Audio Input Device',
    'settings.audioPlaceholder': '-- Select audio device --',
    'settings.midiPort': 'MIDI Input Port',
    'settings.midiPlaceholder': '-- Select MIDI port --',
    'settings.refreshDevices': 'Refresh device list',
    'settings.refreshPorts': 'Refresh port list',
    'settings.frameRate': 'Frame Rate',
    'settings.genMode': 'Generator Mode',
    'settings.freerun': 'Freerun',
    'settings.countdown': 'Countdown',
    'settings.clock': 'Clock',
    'settings.loop': 'Loop',
    'settings.startTc': 'Start Timecode',
    'settings.speed': 'Speed',
    'settings.speedSuffix': 'x',
    'settings.sourceFailed': 'Failed to set source: {msg}',
    'settings.configFailed': 'Config update failed: {msg}',
    'settings.devicesFound': '{count} device(s) found',
    'settings.noDevices': 'No devices found',
    'settings.devicesError': 'Error loading devices',
    'settings.ltcStopped': 'LTC stopped',
    'settings.mtcStopped': 'MTC stopped',
    'settings.listening': 'Listening on: {device}',
    'settings.deviceOpenFailed': 'Failed to open device',
    'settings.midiOpenFailed': 'Failed to open MIDI port',

    // Appearance
    'settings.appearance': 'Appearance',
    'settings.theme': 'Theme',
    'settings.dark': 'Dark',
    'settings.light': 'Light',
    'settings.language': 'Language',
    'settings.background': 'Background',
    'settings.accentColor': 'Accent Color',
    'settings.warningColor': 'Warning Color',
    'settings.tcSize': 'Timecode Size',

    // Server info
    'settings.serverInfo': 'Server Info',
    'settings.serverUrl': 'URL',
    'settings.serverHost': 'Host',
    'settings.serverPort': 'Port',

    // Dashboard
    'dash.connected': 'Connected',
    'dash.usersOnline': 'Users Online',
    'dash.registered': 'Registered',
    'dash.timerControl': 'Timer Control',
    'dash.user': 'User',
    'dash.role': 'Role',
    'dash.online': 'Online',
    'dash.anonymous': 'Anonymous',
    'dash.connection': 'connection',
    'dash.connections': 'connections',
    'dash.control': 'CONTROL',
    'dash.loading': 'Loading\u2026',
    'dash.noUsers': 'No users configured. Click + Add User to create one.',
    'dash.onlineFor': 'Online {duration}',
    'dash.offline': 'Offline',

    // Crew panel
    'crew.loading': 'Loading...',
    'crew.empty': 'No crew assigned.',

    // Toast generic
    'toast.created': '{label} created',
    'toast.updated': '{label} updated',
    'toast.deleted': '{label} deleted',
    'toast.failSave': 'Failed to save {label}: {error}',
    'toast.failDelete': 'Failed to delete {label}: {error}',
    'toast.cueMoved': 'Cue moved',
    'toast.cueMoveFailed': 'Failed to move cue',
    'toast.cueUpdateFailed': 'Failed to update cue',
    'toast.popupBlocked': 'Popup blocked \u2014 please allow popups for this site',

    // Import / Export
    'import.showSuccess': 'Replaced show: {depts} department(s), {cues} cue(s)',
    'import.showPartial': '{depts} department(s), {cues} cue(s) ({errors} cue error(s))',
    'import.cuesSuccess': 'Imported {count} cue(s) successfully',
    'import.cuesPartial': 'Imported {ok}, failed {fail}. First error: {msg}',
    'import.failed': 'Import failed: {msg}',
    'import.csvInvalid': 'CSV must have a header row and at least one data row',
    'import.deptNotFound': 'Row {num}: could not resolve department "{dept}"',
    'import.jsonInvalid': 'JSON must be an array of cues or { "cues": [...] }',
    'import.noCues': 'No cues found in file',

    // Print report
    'print.title': '{name} \u2014 Show Report',
    'print.heading': 'Analytical Show Report',
    'print.showDuration': 'Show Duration',
    'print.showDurationSub': 'First to last armed cue + duration',
    'print.activeCues': 'Active Cues',
    'print.disarmedSuffix': '{count} disarmed',
    'print.contentDuration': 'Total Content Duration',
    'print.contentDurationSub': 'Sum of armed cue durations',
    'print.deptsActs': 'Departments / Acts',
    'print.deptsDefined': '{count} depts defined',
    'print.actsDefined': '{count} acts defined',
    'print.peakConcurrent': 'Peak Concurrent Cues',
    'print.peakSub': 'Max overlapping at any timecode',
    'print.avgWarn': 'Avg Warning Lead',
    'print.avgWarnSub': 'Mean warn_seconds across armed cues',
    'print.overlaps': 'Overlaps Detected',
    'print.overlapsSub': 'Gaps < 0 between consecutive cues',
    'print.automationRate': 'Automation Rate',
    'print.automationSub': '{count} of {total} automated',
    'print.pacing': 'Pacing',
    'print.avgGap': 'Average Gap',
    'print.longestGap': 'Longest Gap',
    'print.tightestGap': 'Tightest Gap',
    'print.continueBreakdown': 'Continue Mode Breakdown',
    'print.disarmedCues': 'Disarmed Cues ({count})',
    'print.deptSummary': 'Department Summary',
    'print.cuesPerDept': 'Cues per Department',
    'print.actBreakdown': 'Act Breakdown',
    'print.actStats': 'Act Statistics',
    'print.actDuration': 'Act Duration',
    'print.timelineDensity': 'Timeline Density',
    'print.timelineHint': 'Each bar represents an armed cue positioned and sized by timecode and duration. Colors match department.',
    'print.cueListing': 'Cue Listing',
    'print.footer': 'Generated by ShowPulse',

    // Print table headers
    'print.th.dept': 'Department',
    'print.th.cues': 'Cues',
    'print.th.armed': 'Armed',
    'print.th.disarmed': 'Disarmed',
    'print.th.firstTc': 'First TC',
    'print.th.lastTc': 'Last TC',
    'print.th.span': 'Span',
    'print.th.contentDur': 'Content Dur',
    'print.th.avgWarn': 'Avg Warn',
    'print.th.notesPct': 'Notes %',
    'print.th.act': 'Act',
    'print.th.startTc': 'Start TC',
    'print.th.endTc': 'End TC',
    'print.th.duration': 'Duration',
    'print.th.depts': 'Depts',
    'print.th.deptNames': 'Department Names',
    'print.th.cueNum': 'Cue #',
    'print.th.label': 'Label',
    'print.th.timecode': 'Timecode',
    'print.th.warn': 'Warn',
    'print.th.continue': 'Continue',
    'print.th.notes': 'Notes',

    // CSV export headers (always English for interoperability)
    'csv.cueNum': 'Cue #',
    'csv.label': 'Label',
    'csv.department': 'Department',
    'csv.act': 'Act',
    'csv.timecode': 'Timecode',
    'csv.warning': 'Warning (s)',
    'csv.duration': 'Duration (s)',
    'csv.armed': 'Armed',
    'csv.continue': 'Continue',
    'csv.notes': 'Notes',

    // Timeline tooltip
    'tl.warn': 'Warn',

    // Init
    'init.loadFailed': 'Failed to load initial data',

    // Auth
    'auth.expired': 'Session expired',
    'auth.sessionReplaced': 'Logged in from another device — this session was closed',
  },

  // ─── Hebrew ────────────────────────────────

  he: {
    // Nav
    'nav.show': '\u05D4\u05E6\u05D2\u05D4',
    'nav.editor': '\u05E2\u05D5\u05E8\u05DA',
    'nav.settings': '\u05D4\u05D2\u05D3\u05E8\u05D5\u05EA',
    'nav.logout': '\u05D4\u05EA\u05E0\u05EA\u05E7',

    // Banner
    'banner.disconnect': '\u05D4\u05D7\u05D9\u05D1\u05D5\u05E8 \u05E0\u05D5\u05EA\u05E7 \u2014 \u05DE\u05EA\u05D7\u05D1\u05E8 \u05DE\u05D7\u05D3\u05E9\u2026',

    // Loading / Login
    'login.heading': 'ShowPulse',
    'login.name': '\u05E9\u05DD',
    'login.pin': '\u05E7\u05D5\u05D3',
    'login.button': '\u05DB\u05E0\u05D9\u05E1\u05D4',
    'login.error.required': '\u05E0\u05D3\u05E8\u05E9\u05D9\u05DD \u05E9\u05DD \u05D5\u05E7\u05D5\u05D3',
    'login.error.invalid': '\u05E9\u05DD \u05D0\u05D5 \u05E7\u05D5\u05D3 \u05E9\u05D2\u05D5\u05D9\u05D9\u05DD',
    'login.success': '\u05E9\u05DC\u05D5\u05DD, {name}',

    // Transport
    'transport.gotoHint': '\u05DC\u05D7\u05E5 \u05E2\u05DC \u05E7\u05D9\u05D5 \u05DC\u05DE\u05E2\u05D1\u05E8',

    // Timecode display
    'tc.stopped': '\u05E2\u05E6\u05D5\u05E8',
    'tc.running': '\u05E4\u05E2\u05D9\u05DC',

    // Timer lock
    'timer.takeControl': '\u05E7\u05D1\u05DC \u05E9\u05DC\u05D9\u05D8\u05D4',
    'timer.release': '\u05E9\u05D7\u05E8\u05E8',
    'timer.locked': '\u05E0\u05E2\u05D5\u05DC',
    'timer.youHaveControl': '\u05D0\u05EA\u05D4 \u05D1\u05E9\u05DC\u05D9\u05D8\u05D4',
    'timer.hasControl': '{name} \u05D1\u05E9\u05DC\u05D9\u05D8\u05D4',
    'timer.acquired': '\u05E9\u05DC\u05D9\u05D8\u05D4 \u05D4\u05EA\u05E7\u05D1\u05DC\u05D4',
    'timer.conflict': '\u05D4\u05D8\u05D9\u05D9\u05DE\u05E8 \u05E0\u05E2\u05D5\u05DC \u05E2\u05DC \u05D9\u05D3\u05D9 \u05DE\u05E0\u05D4\u05DC \u05D0\u05D7\u05E8',
    'timer.released': '\u05E9\u05DC\u05D9\u05D8\u05D4 \u05E9\u05D5\u05D7\u05E8\u05E8\u05D4',
    'timer.acquireFirst': '\u05E7\u05D1\u05DC \u05E9\u05DC\u05D9\u05D8\u05D4 \u05E7\u05D5\u05D3\u05DD',
    'timer.required': '\u05E0\u05D3\u05E8\u05E9\u05EA \u05E9\u05DC\u05D9\u05D8\u05D4',

    // Flow controls
    'flow.now': '\u2907 \u05E2\u05DB\u05E9\u05D9\u05D5',
    'flow.auto': '\u05D0\u05D5\u05D8\u05D5',
    'flow.collapse': '\u25B4 \u05DB\u05D5\u05D5\u05E5',
    'flow.expand': '\u25BE \u05D4\u05E8\u05D7\u05D1',
    'flow.nowTooltip': '\u05E7\u05E4\u05D5\u05E5 \u05DC\u05E0\u05D5\u05DB\u05D7\u05D9 (C)',
    'flow.autoTooltip': '\u05D2\u05DC\u05D9\u05DC\u05D4 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA (A)',
    'flow.collapseTooltip': '\u05DB\u05D5\u05D5\u05E5 \u05D0\u05EA \u05DB\u05DC \u05D4\u05DE\u05E2\u05E8\u05DB\u05D5\u05EA',
    'flow.expandTooltip': '\u05D4\u05E8\u05D7\u05D1 \u05D0\u05EA \u05DB\u05DC \u05D4\u05DE\u05E2\u05E8\u05DB\u05D5\u05EA',

    // Sidebar
    'sidebar.toggle': '\u05E1\u05E8\u05D2\u05DC \u05E6\u05D3 (S)',
    'sidebar.departments': '\u05DE\u05D7\u05DC\u05E7\u05D5\u05EA',
    'sidebar.crew': '\u05E6\u05D5\u05D5\u05EA',
    'sidebar.shortcuts': '\u05E7\u05D9\u05E6\u05D5\u05E8\u05D9\u05DD',
    'sidebar.allDepts': '\u05D4\u05DB\u05DC',

    // Keyboard shortcuts
    'shortcut.play': '\u05E0\u05D2\u05DF',
    'shortcut.pause': '\u05D4\u05E9\u05D4\u05D4',
    'shortcut.stop': '\u05E2\u05E6\u05D5\u05E8',
    'shortcut.nextCue': '\u05E7\u05D9\u05D5 \u05D4\u05D1\u05D0',
    'shortcut.prevCue': '\u05E7\u05D9\u05D5 \u05E7\u05D5\u05D3\u05DD',
    'shortcut.gotoTc': 'Goto TC',
    'shortcut.autoScroll': '\u05D2\u05DC\u05D9\u05DC\u05D4 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA',
    'shortcut.jumpCurrent': '\u05E7\u05E4\u05D5\u05E5 \u05DC\u05E0\u05D5\u05DB\u05D7\u05D9',
    'shortcut.sidebar': '\u05E1\u05E8\u05D2\u05DC \u05E6\u05D3',

    // Show view cue states (ready/go kept in English for all languages)
    'cue.now': '\u05E2\u05DB\u05E9\u05D9\u05D5',
    'cue.noCues': '\u05D0\u05D9\u05DF \u05E7\u05D9\u05D5\u05D9\u05DD \u05E2\u05D3\u05D9\u05D9\u05DF. \u05E2\u05D1\u05D5\u05E8 \u05DC\u05E2\u05D5\u05E8\u05DA \u05DB\u05D3\u05D9 \u05DC\u05D4\u05D5\u05E1\u05D9\u05E3.',
    'cue.noMatch': '\u05D0\u05D9\u05DF \u05E7\u05D9\u05D5\u05D9\u05DD \u05EA\u05D5\u05D0\u05DE\u05D9\u05DD.',

    // Editor panels
    'editor.departments': '\u05DE\u05D7\u05DC\u05E7\u05D5\u05EA',
    'editor.acts': '\u05DE\u05E2\u05E8\u05DB\u05D5\u05EA',
    'editor.cueList': '\u05E8\u05E9\u05D9\u05DE\u05EA \u05E7\u05D9\u05D5\u05D9\u05DD',
    'editor.allDepts': '\u05DB\u05DC \u05D4\u05DE\u05D7\u05DC\u05E7\u05D5\u05EA',
    'editor.import': '\u05D9\u05D9\u05D1\u05D5\u05D0',
    'editor.importReplace': '\u05D4\u05D7\u05DC\u05E3 \u05D4\u05DB\u05DC',
    'editor.importAppend': '\u05D4\u05D5\u05E1\u05E3',
    'editor.exportJson': '\u05D9\u05D9\u05E6\u05D5\u05D0 JSON',
    'editor.exportCsv': '\u05D9\u05D9\u05E6\u05D5\u05D0 CSV',
    'editor.printReport': '\u05D4\u05D3\u05E4\u05E1 \u05D3\u05D5\u05D7',
    'editor.add': '+ \u05D4\u05D5\u05E1\u05E3',

    // Editor empty states
    'editor.noDepts': '\u05D0\u05D9\u05DF \u05DE\u05D7\u05DC\u05E7\u05D5\u05EA \u05E2\u05D3\u05D9\u05D9\u05DF.',
    'editor.noActs': '\u05D0\u05D9\u05DF \u05DE\u05E2\u05E8\u05DB\u05D5\u05EA \u05E2\u05D3\u05D9\u05D9\u05DF.',
    'editor.noCues': '\u05D0\u05D9\u05DF \u05E7\u05D9\u05D5\u05D9\u05DD \u05E2\u05D3\u05D9\u05D9\u05DF.',
    'editor.ungrouped': '\u05DC\u05DC\u05D0 \u05DE\u05E2\u05E8\u05DB\u05D4',

    // Editor cue list
    'editor.cue': '\u05E7\u05D9\u05D5',
    'editor.cues': '\u05E7\u05D9\u05D5\u05D9\u05DD',
    'editor.dragHint': '\u05D2\u05E8\u05D5\u05E8 \u05DC\u05E1\u05D9\u05D3\u05D5\u05E8',
    'editor.duplicate': '\u05E9\u05DB\u05E4\u05DC',
    'editor.edit': '\u05E2\u05E8\u05D5\u05DA',
    'editor.delete': '\u05DE\u05D7\u05E7',

    // Bulk bar
    'bulk.selected': '{count} \u05E0\u05D1\u05D7\u05E8\u05D5',
    'bulk.moveTo': '\u05D4\u05E2\u05D1\u05E8 \u05DC\u2026',
    'bulk.duplicate': '\u05E9\u05DB\u05E4\u05DC',
    'bulk.arm': '\u05D4\u05E4\u05E2\u05DC',
    'bulk.disarm': '\u05D4\u05E9\u05D1\u05EA',
    'bulk.delete': '\u05DE\u05D7\u05E7',
    'bulk.clear': '\u05E0\u05E7\u05D4 \u05D1\u05D7\u05D9\u05E8\u05D4',
    'bulk.moved': '\u05D4\u05D5\u05E2\u05D1\u05E8\u05D5 {count} \u05E7\u05D9\u05D5\u05D9\u05DD',
    'bulk.duplicated': '\u05E9\u05D5\u05DB\u05E4\u05DC\u05D5 {count} \u05E7\u05D9\u05D5\u05D9\u05DD',
    'bulk.deleted': '\u05E0\u05DE\u05D7\u05E7\u05D5 {count} \u05E7\u05D9\u05D5\u05D9\u05DD',
    'bulk.armed': '\u05D4\u05D5\u05E4\u05E2\u05DC\u05D5 {count} \u05E7\u05D9\u05D5\u05D9\u05DD',
    'bulk.disarmed': '\u05D4\u05D5\u05E9\u05D1\u05EA\u05D5 {count} \u05E7\u05D9\u05D5\u05D9\u05DD',
    'bulk.confirmDelete': '\u05DC\u05DE\u05D7\u05D5\u05E7 {count} \u05E7\u05D9\u05D5\u05D9\u05DD \u05E9\u05E0\u05D1\u05D7\u05E8\u05D5?',

    // Department modal
    'dept.add': '\u05D4\u05D5\u05E1\u05E3 \u05DE\u05D7\u05DC\u05E7\u05D4',
    'dept.edit': '\u05E2\u05E8\u05D5\u05DA \u05DE\u05D7\u05DC\u05E7\u05D4',
    'dept.name': '\u05E9\u05DD',
    'dept.namePlaceholder': '\u05DC\u05DE\u05E9\u05DC: \u05EA\u05D0\u05D5\u05E8\u05D4',
    'dept.color': '\u05E6\u05D1\u05E2',
    'dept.confirmDelete': '\u05DC\u05DE\u05D7\u05D5\u05E7 \u05D0\u05EA \u05D4\u05DE\u05D7\u05DC\u05E7\u05D4 \u05D5\u05DB\u05DC \u05D4\u05E7\u05D9\u05D5\u05D9\u05DD \u05E9\u05DC\u05D4?',
    'dept.deleteTitle': '\u05DE\u05D7\u05D9\u05E7\u05EA \u05DE\u05D7\u05DC\u05E7\u05D4',

    // Cue modal
    'cueModal.add': '\u05D4\u05D5\u05E1\u05E3 \u05E7\u05D9\u05D5',
    'cueModal.edit': '\u05E2\u05E8\u05D5\u05DA \u05E7\u05D9\u05D5',
    'cueModal.label': '\u05EA\u05D9\u05D0\u05D5\u05E8',
    'cueModal.labelPlaceholder': '\u05DC\u05DE\u05E9\u05DC: \u05DB\u05D9\u05D1\u05D5\u05D9 \u05D0\u05D5\u05E8\u05D5\u05EA \u05D0\u05D5\u05DC\u05DD',
    'cueModal.department': '\u05DE\u05D7\u05DC\u05E7\u05D4',
    'cueModal.act': '\u05DE\u05E2\u05E8\u05DB\u05D4',
    'cueModal.noAct': '\u2014 \u05DC\u05DC\u05D0 \u05DE\u05E2\u05E8\u05DB\u05D4 \u2014',
    'cueModal.triggerTc': '\u05D8\u05D9\u05D9\u05DE\u05E7\u05D5\u05D3 \u05D4\u05E4\u05E2\u05DC\u05D4',
    'cueModal.warning': '\u05D0\u05D6\u05D4\u05E8\u05D4',
    'cueModal.sec': '\u05E9\u05E0\u05D9\u05D5\u05EA',
    'cueModal.advanced': '\u05DE\u05EA\u05E7\u05D3\u05DD',
    'cueModal.cueNumber': '\u05E7\u05D9\u05D5 #',
    'cueModal.cueNumberPlaceholder': '\u05D0\u05D5\u05D8\u05D5',
    'cueModal.duration': '\u05DE\u05E9\u05DA',
    'cueModal.armed': '\u05DE\u05D5\u05E4\u05E2\u05DC',
    'cueModal.armedYes': '\u05DB\u05DF',
    'cueModal.armedNo': '\u05DC\u05D0',
    'cueModal.continueMode': '\u05DE\u05E6\u05D1 \u05D4\u05DE\u05E9\u05DA',
    'cueModal.stop': '\u05E2\u05E6\u05D5\u05E8',
    'cueModal.autoContinue': '\u05D4\u05DE\u05E9\u05DA \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9',
    'cueModal.autoFollow': '\u05DE\u05E2\u05E7\u05D1 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9',
    'cueModal.postWait': '\u05D4\u05DE\u05EA\u05E0\u05D4 \u05D0\u05D7\u05E8\u05D9',
    'cueModal.notes': '\u05D4\u05E2\u05E8\u05D5\u05EA',
    'cueModal.notesPlaceholder': '\u05D4\u05E2\u05E8\u05D5\u05EA \u05D0\u05D5\u05E4\u05E6\u05D9\u05D5\u05E0\u05DC\u05D9\u05D5\u05EA\u2026',
    'cueModal.saveAnother': '\u05E9\u05DE\u05D5\u05E8 \u05D5\u05D4\u05D5\u05E1\u05E3 \u05E2\u05D5\u05D3',
    'cueModal.deleteTitle': '\u05DE\u05D7\u05D9\u05E7\u05EA \u05E7\u05D9\u05D5',
    'cueModal.confirmDelete': '\u05DC\u05DE\u05D7\u05D5\u05E7 \u05D0\u05EA \u05D4\u05E7\u05D9\u05D5?',
    'cueModal.duplicated': '\u05D4\u05E7\u05D9\u05D5 \u05E9\u05D5\u05DB\u05E4\u05DC',
    'cueModal.duplicateFailed': '\u05E9\u05DB\u05E4\u05D5\u05DC \u05D4\u05E7\u05D9\u05D5 \u05E0\u05DB\u05E9\u05DC',

    // Act modal
    'actModal.add': '\u05D4\u05D5\u05E1\u05E3 \u05DE\u05E2\u05E8\u05DB\u05D4',
    'actModal.edit': '\u05E2\u05E8\u05D5\u05DA \u05DE\u05E2\u05E8\u05DB\u05D4',
    'actModal.name': '\u05E9\u05DD',
    'actModal.namePlaceholder': '\u05DC\u05DE\u05E9\u05DC: \u05DE\u05E2\u05E8\u05DB\u05D4 1 \u2014 \u05E4\u05EA\u05D9\u05D7\u05D4',
    'actModal.sortOrder': '\u05E1\u05D3\u05E8 \u05DE\u05D9\u05D5\u05DF',
    'actModal.deleteTitle': '\u05DE\u05D7\u05D9\u05E7\u05EA \u05DE\u05E2\u05E8\u05DB\u05D4',
    'actModal.confirmDelete': '\u05DC\u05DE\u05D7\u05D5\u05E7 \u05DE\u05E2\u05E8\u05DB\u05D4? \u05D4\u05E7\u05D9\u05D5\u05D9\u05DD \u05D9\u05D5\u05E1\u05E8\u05D5 \u05DE\u05E9\u05D9\u05D5\u05DA.',
    'actModal.duplicatePrompt': '\u05D4\u05D6\u05D6\u05EA \u05D6\u05DE\u05DF \u05DC\u05E7\u05D9\u05D5\u05D9\u05DD \u05DE\u05E9\u05D5\u05DB\u05E4\u05DC\u05D9\u05DD (\u05E9\u05E0\u05D9\u05D5\u05EA):',
    'actModal.duplicated': '\u05E9\u05D5\u05DB\u05E4\u05DC "{name}" \u05E2\u05DD {count} \u05E7\u05D9\u05D5\u05D9\u05DD',
    'actModal.duplicateFailed': '\u05E9\u05DB\u05E4\u05D5\u05DC \u05D4\u05DE\u05E2\u05E8\u05DB\u05D4 \u05E0\u05DB\u05E9\u05DC',

    // User modal
    'userModal.add': '\u05D4\u05D5\u05E1\u05E3 \u05DE\u05E9\u05EA\u05DE\u05E9',
    'userModal.edit': '\u05E2\u05E8\u05D5\u05DA \u05DE\u05E9\u05EA\u05DE\u05E9',
    'userModal.name': '\u05E9\u05DD',
    'userModal.namePlaceholder': '\u05DC\u05DE\u05E9\u05DC: \u05D9\u05D5\u05E1\u05D9',
    'userModal.pin': '\u05E7\u05D5\u05D3',
    'userModal.pinPlaceholder': '\u05E7\u05D5\u05D3',
    'userModal.pinKeep': '\u05D4\u05E9\u05D0\u05E8 \u05E8\u05D9\u05E7 \u05DC\u05E9\u05DE\u05D5\u05E8 \u05E2\u05DC \u05D4\u05E0\u05D5\u05DB\u05D7\u05D9',
    'userModal.role': '\u05EA\u05E4\u05E7\u05D9\u05D3',
    'userModal.deptFilter': '\u05DE\u05D7\u05DC\u05E7\u05D5\u05EA (\u05E1\u05D9\u05E0\u05D5\u05DF \u05DC\u05E6\u05D5\u05E4\u05D4/\u05E8\u05D0\u05E9 \u05E6\u05D5\u05D5\u05EA)',
    'userModal.deleteTitle': '\u05DE\u05D7\u05D9\u05E7\u05EA \u05DE\u05E9\u05EA\u05DE\u05E9',
    'userModal.confirmDelete': '\u05DC\u05DE\u05D7\u05D5\u05E7 \u05DE\u05E9\u05EA\u05DE\u05E9 "{name}"?',
    'userModal.nameRequired': '\u05E9\u05DD \u05D4\u05D5\u05D0 \u05E9\u05D3\u05D4 \u05D7\u05D5\u05D1\u05D4',
    'userModal.pinRequired': '\u05E7\u05D5\u05D3 \u05E0\u05D3\u05E8\u05E9 \u05DC\u05DE\u05E9\u05EA\u05DE\u05E9\u05D9\u05DD \u05D7\u05D3\u05E9\u05D9\u05DD',

    // Roles
    'role.viewer': '\u05E6\u05D5\u05E4\u05D4',
    'role.crew_lead': '\u05E8\u05D0\u05E9 \u05E6\u05D5\u05D5\u05EA',
    'role.operator': '\u05DE\u05E4\u05E2\u05D9\u05DC',
    'role.manager': '\u05DE\u05E0\u05D4\u05DC',
    'role.admin': '\u05DE\u05E0\u05D4\u05DC \u05DE\u05E2\u05E8\u05DB\u05EA',

    // Entity names
    'entity.department': '\u05DE\u05D7\u05DC\u05E7\u05D4',
    'entity.cue': '\u05E7\u05D9\u05D5',
    'entity.act': '\u05DE\u05E2\u05E8\u05DB\u05D4',
    'entity.user': '\u05DE\u05E9\u05EA\u05DE\u05E9',

    // Generic modal buttons
    'modal.cancel': '\u05D1\u05D9\u05D8\u05D5\u05DC',
    'modal.save': '\u05E9\u05DE\u05D5\u05E8',
    'modal.delete': '\u05DE\u05D7\u05E7',
    'modal.confirm': '\u05D0\u05D9\u05E9\u05D5\u05E8',

    // Settings panels
    'settings.users': '\u05DE\u05E9\u05EA\u05DE\u05E9\u05D9\u05DD',
    'settings.refresh': '\u05E8\u05E2\u05E0\u05DF',
    'settings.addUser': '+ \u05D4\u05D5\u05E1\u05E3 \u05DE\u05E9\u05EA\u05DE\u05E9',
    'settings.show': '\u05DE\u05D5\u05E4\u05E2',
    'settings.showName': '\u05E9\u05DD \u05D4\u05DE\u05D5\u05E4\u05E2',
    'settings.showNamePlaceholder': '\u05D4\u05DE\u05D5\u05E4\u05E2 \u05E9\u05DC\u05D9',
    'settings.save': '\u05E9\u05DE\u05D5\u05E8',
    'settings.showNameUpdated': '\u05E9\u05DD \u05D4\u05DE\u05D5\u05E4\u05E2 \u05E2\u05D5\u05D3\u05DB\u05DF',
    'settings.showNameFailed': '\u05E2\u05D3\u05DB\u05D5\u05DF \u05E9\u05DD \u05D4\u05DE\u05D5\u05E4\u05E2 \u05E0\u05DB\u05E9\u05DC',

    // Timecode settings
    'settings.timecode': '\u05D8\u05D9\u05D9\u05DE\u05E7\u05D5\u05D3',
    'settings.source': '\u05DE\u05E7\u05D5\u05E8',
    'settings.generator': '\u05D2\u05E0\u05E8\u05D8\u05D5\u05E8',
    'settings.audioDevice': '\u05DE\u05DB\u05E9\u05D9\u05E8 \u05E9\u05DE\u05E2',
    'settings.midiPort': '\u05E4\u05D5\u05E8\u05D8 MIDI',
    'settings.refreshDevices': '\u05E8\u05E2\u05E0\u05DF \u05E8\u05E9\u05D9\u05DE\u05EA \u05DE\u05DB\u05E9\u05D9\u05E8\u05D9\u05DD',
    'settings.refreshPorts': '\u05E8\u05E2\u05E0\u05DF \u05E8\u05E9\u05D9\u05DE\u05EA \u05E4\u05D5\u05E8\u05D8\u05D9\u05DD',
    'settings.frameRate': '\u05E7\u05E6\u05D1 \u05E4\u05E8\u05D9\u05D9\u05DE\u05D9\u05DD',
    'settings.genMode': '\u05DE\u05E6\u05D1 \u05D2\u05E0\u05E8\u05D8\u05D5\u05E8',
    'settings.freerun': '\u05E8\u05E6\u05D9\u05E4\u05D4 \u05D7\u05D5\u05E4\u05E9\u05D9\u05EA',
    'settings.countdown': '\u05E1\u05E4\u05D9\u05E8\u05D4 \u05DC\u05D0\u05D7\u05D5\u05E8',
    'settings.clock': '\u05E9\u05E2\u05D5\u05DF',
    'settings.loop': '\u05DC\u05D5\u05DC\u05D0\u05D4',
    'settings.startTc': '\u05D8\u05D9\u05D9\u05DE\u05E7\u05D5\u05D3 \u05D4\u05EA\u05D7\u05DC\u05D4',
    'settings.speed': '\u05DE\u05D4\u05D9\u05E8\u05D5\u05EA',

    // Appearance
    'settings.appearance': '\u05DE\u05E8\u05D0\u05D4',
    'settings.theme': '\u05E2\u05E8\u05DB\u05EA \u05E0\u05D5\u05E9\u05D0',
    'settings.dark': '\u05DB\u05D4\u05D4',
    'settings.light': '\u05D1\u05D4\u05D9\u05E8',
    'settings.language': '\u05E9\u05E4\u05D4',
    'settings.background': '\u05E8\u05E7\u05E2',
    'settings.accentColor': '\u05E6\u05D1\u05E2 \u05D3\u05D2\u05E9',
    'settings.warningColor': '\u05E6\u05D1\u05E2 \u05D0\u05D6\u05D4\u05E8\u05D4',
    'settings.tcSize': '\u05D2\u05D5\u05D3\u05DC \u05D8\u05D9\u05D9\u05DE\u05E7\u05D5\u05D3',

    // Server info
    'settings.serverInfo': '\u05DE\u05D9\u05D3\u05E2 \u05E9\u05E8\u05EA',
    'settings.serverUrl': 'URL',
    'settings.serverHost': '\u05DB\u05EA\u05D5\u05D1\u05EA',
    'settings.serverPort': '\u05E4\u05D5\u05E8\u05D8',

    // Dashboard
    'dash.connected': '\u05DE\u05D7\u05D5\u05D1\u05E8\u05D9\u05DD',
    'dash.usersOnline': '\u05DE\u05E9\u05EA\u05DE\u05E9\u05D9\u05DD \u05DE\u05E7\u05D5\u05D5\u05E0\u05D9\u05DD',
    'dash.registered': '\u05E8\u05E9\u05D5\u05DE\u05D9\u05DD',
    'dash.timerControl': '\u05E9\u05DC\u05D9\u05D8\u05EA \u05D8\u05D9\u05D9\u05DE\u05E8',
    'dash.user': '\u05DE\u05E9\u05EA\u05DE\u05E9',
    'dash.role': '\u05EA\u05E4\u05E7\u05D9\u05D3',
    'dash.online': '\u05DE\u05E7\u05D5\u05D5\u05DF',
    'dash.anonymous': '\u05D0\u05E0\u05D5\u05E0\u05D9\u05DE\u05D9',
    'dash.connection': '\u05D7\u05D9\u05D1\u05D5\u05E8',
    'dash.connections': '\u05D7\u05D9\u05D1\u05D5\u05E8\u05D9\u05DD',
    'dash.control': '\u05E9\u05DC\u05D9\u05D8\u05D4',
    'dash.loading': '\u05D8\u05D5\u05E2\u05DF\u2026',
    'dash.noUsers': '\u05D0\u05D9\u05DF \u05DE\u05E9\u05EA\u05DE\u05E9\u05D9\u05DD. \u05DC\u05D7\u05E5 + \u05D4\u05D5\u05E1\u05E3 \u05DE\u05E9\u05EA\u05DE\u05E9 \u05DC\u05D9\u05E6\u05D9\u05E8\u05D4.',
    'dash.onlineFor': '\u05DE\u05E7\u05D5\u05D5\u05DF {duration}',
    'dash.offline': '\u05DC\u05D0 \u05DE\u05E7\u05D5\u05D5\u05DF',

    // Crew panel
    'crew.loading': '\u05D8\u05D5\u05E2\u05DF\u2026',
    'crew.empty': '\u05D0\u05D9\u05DF \u05D0\u05E0\u05E9\u05D9 \u05E6\u05D5\u05D5\u05EA.',

    // Toast generic
    'toast.created': '{label} \u05E0\u05D5\u05E6\u05E8',
    'toast.updated': '{label} \u05E2\u05D5\u05D3\u05DB\u05DF',
    'toast.deleted': '{label} \u05E0\u05DE\u05D7\u05E7',
    'toast.failSave': '\u05E9\u05DE\u05D9\u05E8\u05EA {label} \u05E0\u05DB\u05E9\u05DC\u05D4: {error}',
    'toast.failDelete': '\u05DE\u05D7\u05D9\u05E7\u05EA {label} \u05E0\u05DB\u05E9\u05DC\u05D4: {error}',
    'toast.cueMoved': '\u05D4\u05E7\u05D9\u05D5 \u05D4\u05D5\u05E2\u05D1\u05E8',
    'toast.cueMoveFailed': '\u05D4\u05E2\u05D1\u05E8\u05EA \u05E7\u05D9\u05D5 \u05E0\u05DB\u05E9\u05DC\u05D4',
    'toast.cueUpdateFailed': '\u05E2\u05D3\u05DB\u05D5\u05DF \u05E7\u05D9\u05D5 \u05E0\u05DB\u05E9\u05DC',
    'toast.popupBlocked': '\u05D7\u05DC\u05D5\u05DF \u05E7\u05D5\u05E4\u05E5 \u05E0\u05D7\u05E1\u05DD \u2014 \u05D0\u05E0\u05D0 \u05D0\u05E4\u05E9\u05E8 \u05D7\u05DC\u05D5\u05E0\u05D5\u05EA \u05E7\u05D5\u05E4\u05E6\u05D9\u05DD',

    // Import / Export
    'import.showSuccess': '\u05D4\u05DE\u05D5\u05E4\u05E2 \u05D4\u05D5\u05D7\u05DC\u05E3: {depts} \u05DE\u05D7\u05DC\u05E7\u05D5\u05EA, {cues} \u05E7\u05D9\u05D5\u05D9\u05DD',
    'import.failed': '\u05D9\u05D9\u05D1\u05D5\u05D0 \u05E0\u05DB\u05E9\u05DC: {msg}',
    'import.csvInvalid': 'CSV \u05D7\u05D9\u05D9\u05D1 \u05DC\u05DB\u05DC\u05D5\u05DC \u05E9\u05D5\u05E8\u05EA \u05DB\u05D5\u05EA\u05E8\u05D5\u05EA \u05D5\u05DC\u05E4\u05D7\u05D5\u05EA \u05E9\u05D5\u05E8\u05EA \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05D0\u05D7\u05EA',
    'import.noCues': '\u05DC\u05D0 \u05E0\u05DE\u05E6\u05D0\u05D5 \u05E7\u05D9\u05D5\u05D9\u05DD \u05D1\u05E7\u05D5\u05D1\u05E5',

    // Timeline tooltip
    'tl.warn': '\u05D0\u05D6\u05D4\u05E8\u05D4',

    // Init
    'init.loadFailed': '\u05D8\u05E2\u05D9\u05E0\u05EA \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05E8\u05D0\u05E9\u05D5\u05E0\u05D9\u05DD \u05E0\u05DB\u05E9\u05DC\u05D4',

    // Auth
    'auth.expired': '\u05D4\u05E9\u05D9\u05D7\u05D4 \u05E4\u05D2\u05D4 \u05EA\u05D5\u05E7\u05E3',
    'auth.sessionReplaced': '\u05D4\u05EA\u05D7\u05D1\u05E8\u05EA \u05DE\u05DE\u05DB\u05E9\u05D9\u05E8 \u05D0\u05D7\u05E8 \u2014 \u05D4\u05E9\u05D9\u05D7\u05D4 \u05E0\u05E1\u05D2\u05E8\u05D4',
  },
};

// ── Translate function ──────────────────────

/**
 * Translate a key, with optional parameter interpolation.
 * Falls back to English, then to the raw key.
 * @param {string} key - Dot-notation key (e.g. 'nav.show').
 * @param {Object<string,string|number>} [params] - Values for {param} placeholders.
 * @returns {string} Translated string.
 */
function t(key, params) {
  let str = (I18N[currentLang] && I18N[currentLang][key]) || I18N.en[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replaceAll(`{${k}}`, v);
    }
  }
  return str;
}

/**
 * Switch language, update document direction, persist, and re-render.
 * @param {string} lang - Language code ('en' or 'he').
 */
function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('showpulse-lang', lang);
  document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
  // Re-render all views to pick up new strings
  if (typeof refreshAllViews === 'function') refreshAllViews();
}

/**
 * Apply persisted language direction on load (before any rendering).
 * Called once from ui-helpers.js init or inline.
 */
function applyLanguage() {
  document.documentElement.dir = currentLang === 'he' ? 'rtl' : 'ltr';
  document.documentElement.lang = currentLang;
}

/**
 * Scan DOM for data-i18n, data-i18n-placeholder, data-i18n-title attributes
 * and apply translations from the current language dictionary.
 * @param {Element} [root=document] - Scope to scan (defaults to full document).
 */
function applyI18nToDOM(root) {
  const scope = root || document;

  // textContent
  scope.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });

  // placeholder attribute
  scope.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });

  // title attribute
  scope.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
}
