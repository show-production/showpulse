import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import * as readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';
import { LTC_HEARTBEAT_INTERVAL_MS, LTC_MISSED_HEARTBEAT_THRESHOLD, LTC_RESTART_DELAY_MS, } from '@showpulse/shared';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
/**
 * LTC Sidecar — spawns a Python process that reads LTC audio
 * and communicates via NDJSON over stdio.
 */
export class LtcSidecar extends EventEmitter {
    sourceType = 'ltc';
    priority = 30;
    process = null;
    available = false;
    currentFrames = null;
    lastHeartbeat = 0;
    heartbeatCheckTimer = null;
    pythonPath;
    sidecarPath;
    shouldRun = false;
    constructor(pythonPath) {
        super();
        const projectRoot = path.resolve(__dirname, '../../../../');
        this.sidecarPath = path.join(projectRoot, 'sidecar', 'ltc_reader.py');
        if (pythonPath) {
            this.pythonPath = pythonPath;
        }
        else {
            // Try venv first
            const venvPython = path.join(projectRoot, 'sidecar', '.venv', 'bin', 'python');
            this.pythonPath = venvPython;
        }
    }
    start() {
        this.shouldRun = true;
        this.spawnProcess();
    }
    stop() {
        this.shouldRun = false;
        this.killProcess();
        if (this.heartbeatCheckTimer) {
            clearInterval(this.heartbeatCheckTimer);
            this.heartbeatCheckTimer = null;
        }
    }
    isAvailable() {
        return this.available;
    }
    getCurrentFrames() {
        return this.currentFrames;
    }
    spawnProcess() {
        try {
            this.process = spawn(this.pythonPath, [this.sidecarPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
            });
        }
        catch (err) {
            console.log('[LtcSidecar] Failed to spawn Python process — LTC unavailable');
            return;
        }
        if (!this.process.stdout)
            return;
        const rl = readline.createInterface({ input: this.process.stdout });
        rl.on('line', (line) => {
            try {
                const msg = JSON.parse(line);
                this.handleMessage(msg);
            }
            catch {
                // Ignore malformed lines
            }
        });
        this.process.stderr?.on('data', (data) => {
            console.error(`[LtcSidecar] stderr: ${data.toString().trim()}`);
        });
        this.process.on('exit', (code) => {
            console.log(`[LtcSidecar] Process exited with code ${code}`);
            this.setAvailable(false);
            this.process = null;
            if (this.shouldRun) {
                console.log(`[LtcSidecar] Restarting in ${LTC_RESTART_DELAY_MS}ms...`);
                setTimeout(() => {
                    if (this.shouldRun)
                        this.spawnProcess();
                }, LTC_RESTART_DELAY_MS);
            }
        });
        // Start heartbeat monitoring
        this.lastHeartbeat = Date.now();
        if (!this.heartbeatCheckTimer) {
            this.heartbeatCheckTimer = setInterval(() => {
                this.checkHeartbeat();
            }, LTC_HEARTBEAT_INTERVAL_MS);
        }
        console.log('[LtcSidecar] Python process spawned');
    }
    handleMessage(msg) {
        if (msg.type === 'heartbeat') {
            this.lastHeartbeat = Date.now();
            if (!this.available) {
                this.setAvailable(true);
            }
        }
        else if (msg.type === 'frame' && msg.totalFrames !== undefined) {
            this.lastHeartbeat = Date.now();
            this.currentFrames = msg.totalFrames;
            this.emit('frame', msg.totalFrames);
        }
    }
    checkHeartbeat() {
        const elapsed = Date.now() - this.lastHeartbeat;
        const threshold = LTC_HEARTBEAT_INTERVAL_MS * LTC_MISSED_HEARTBEAT_THRESHOLD;
        if (elapsed > threshold && this.available) {
            console.log(`[LtcSidecar] ${LTC_MISSED_HEARTBEAT_THRESHOLD} heartbeats missed — marking unavailable`);
            this.setAvailable(false);
        }
    }
    setAvailable(value) {
        if (this.available !== value) {
            this.available = value;
            this.emit('available', value);
        }
    }
    killProcess() {
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
        this.setAvailable(false);
        this.currentFrames = null;
    }
}
//# sourceMappingURL=ltc-sidecar.js.map