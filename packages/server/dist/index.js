import express from 'express';
import { createServer } from 'http';
import session from 'express-session';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { initDb, closeDb } from './db/connection.js';
import { LogBuffer } from './db/log-buffer.js';
import { Reconciler } from './timecode/reconciler.js';
import { InternalClock } from './timecode/internal-clock.js';
import { TcSimulator } from './timecode/tc-simulator.js';
import { LtcSidecar } from './timecode/ltc-sidecar.js';
import { MtcParser } from './timecode/mtc-parser.js';
import { CueStateManager } from './cue-engine/state-manager.js';
import { CueEvaluator } from './cue-engine/evaluator.js';
import { createSocketServer } from './socket/setup.js';
import { registerSocketHandlers } from './socket/handlers.js';
import { authRoutes } from './auth/pin-routes.js';
import { showRoutes } from './routes/shows.js';
import { departmentRoutes } from './routes/departments.js';
import { cueRoutes } from './routes/cues.js';
import { createTimecodeRoutes } from './routes/timecode.js';
import { registerMdns } from './discovery/mdns.js';
import * as cueQueries from './db/queries/cues.js';
const __indexDirname = path.dirname(fileURLToPath(import.meta.url));
// --- Initialize ---
console.log('ShowPulse Server starting...');
// Database
const db = initDb();
console.log(`[DB] SQLite initialized (WAL mode) at ${config.dbPath}`);
// Log buffer
const logBuffer = new LogBuffer();
logBuffer.start();
// Timecode pipeline
const reconciler = new Reconciler(config.fps);
const stateManager = new CueStateManager(config.fps);
const evaluator = new CueEvaluator(reconciler, stateManager, config.fps);
// Set up timecode sources
if (config.demoMode) {
    const simulator = new TcSimulator(config.fps, 1);
    reconciler.addSource(simulator);
    simulator.start();
    console.log('[TC] Demo mode — using TcSimulator');
}
else {
    // Internal clock (always available as fallback)
    const internalClock = new InternalClock(config.fps);
    reconciler.addSource(internalClock);
    internalClock.start();
    // MTC (Phase 1b)
    const mtcParser = new MtcParser(config.fps, config.midiPort);
    reconciler.addSource(mtcParser);
    mtcParser.start();
    // LTC sidecar (Phase 1c)
    const ltcSidecar = new LtcSidecar(config.pythonPath || undefined);
    reconciler.addSource(ltcSidecar);
    // Start only if Python is available (explicit path or venv exists)
    const venvPython = path.join(path.resolve(__indexDirname, '../../../..'), 'sidecar', '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
    const hasPython = config.pythonPath || fs.existsSync(venvPython);
    if (hasPython) {
        const pythonUsed = config.pythonPath || venvPython;
        console.log(`[LtcSidecar] Starting with Python: ${pythonUsed}`);
        ltcSidecar.start();
    }
    else {
        console.log('[LtcSidecar] Python not found — skipping');
    }
}
// --- Express app ---
const app = express();
const httpServer = createServer(app);
app.use(cors());
app.use(express.json());
// Session middleware
app.use(session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false, // Set to true behind HTTPS proxy
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
}));
// API routes
app.use('/api/auth', authRoutes);
app.use('/api/shows', showRoutes);
app.use('/api/shows/:showId/departments', departmentRoutes);
app.use('/api/shows/:showId/cues', cueRoutes);
app.use('/api/timecode', createTimecodeRoutes(reconciler, config.fps));
// Health check
app.get('/api/health', (_req, res) => {
    res.json({ ok: true, fps: config.fps, demoMode: config.demoMode });
});
// --- Static file serving (production) ---
const clientDistPath = path.resolve(__indexDirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    // SPA catch-all: any non-/api GET serves index.html
    app.get(/^(?!\/api\/).*/, (_req, res) => {
        res.sendFile(path.join(clientDistPath, 'index.html'));
    });
    console.log(`[Static] Serving client from ${clientDistPath}`);
}
// --- Socket.IO ---
const io = createSocketServer(httpServer);
// Show state
let showStatus = 'idle';
let activeShowId = null;
registerSocketHandlers({
    io,
    reconciler,
    evaluator,
    stateManager,
    fps: config.fps,
    getShowStatus: () => showStatus,
    setShowStatus: (status) => {
        showStatus = status;
        if (status === 'running' && activeShowId) {
            // Reload cues when show starts
            const cues = cueQueries.getCuesForEvaluation(activeShowId);
            stateManager.loadCues(cues);
            stateManager.resetAll();
        }
    },
    getActiveShowId: () => activeShowId,
});
// Broadcast timecode frames to all connected clients
reconciler.on('tc:update', (event) => {
    io.emit('tc:frame', {
        tc: event.tc,
        totalFrames: event.totalFrames,
        source: event.source,
    });
});
// Broadcast cue state changes to appropriate department rooms
evaluator.on('cue:state-change', (info) => {
    // Send to all department rooms this cue targets
    for (const deptId of info.department_ids) {
        io.to(`dept:${deptId}`).emit('cue:state-change', info);
    }
    // Also broadcast to all (for admin/operator views)
    io.emit('cue:state-change', info);
});
evaluator.on('cue:go', (info) => {
    for (const deptId of info.department_ids) {
        io.to(`dept:${deptId}`).emit('cue:go', info);
    }
    // Log cue fire
    if (activeShowId) {
        logBuffer.push({
            show_id: activeShowId,
            event_type: 'cue:go',
            cue_id: info.cue_id,
            tc_frames: reconciler.getCurrentFrames() ?? undefined,
            payload: JSON.stringify({ cue_number: info.cue_number, label: info.label }),
        });
    }
});
// Start the cue evaluator
evaluator.start();
// --- API to set active show ---
app.post('/api/active-show/:showId', (req, res) => {
    const showId = Number(req.params.showId);
    activeShowId = showId;
    // Load cues for this show
    const cues = cueQueries.getCuesForEvaluation(showId);
    stateManager.loadCues(cues);
    console.log(`[Show] Active show set to ${showId} — loaded ${cues.length} cues`);
    res.json({ ok: true, showId, cueCount: cues.length });
});
// --- Start server ---
let mdnsCleanup = null;
httpServer.listen(config.port, () => {
    console.log(`ShowPulse server listening on http://localhost:${config.port}`);
    console.log(`  FPS: ${config.fps}`);
    console.log(`  Demo mode: ${config.demoMode}`);
    console.log(`  Auth: ${config.adminPin ? 'PIN required' : 'open (dev mode)'}`);
    mdnsCleanup = registerMdns(config.mdnsName, config.port);
});
// --- Graceful shutdown ---
function shutdown() {
    console.log('\nShutting down...');
    mdnsCleanup?.();
    evaluator.stop();
    logBuffer.stop();
    closeDb();
    httpServer.close();
    process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
//# sourceMappingURL=index.js.map