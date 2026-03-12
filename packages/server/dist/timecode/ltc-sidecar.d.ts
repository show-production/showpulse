import { EventEmitter } from 'events';
import type { TcSourceProvider } from './types.js';
import type { TcSourceType } from '@showpulse/shared';
/**
 * LTC Sidecar — spawns a Python process that reads LTC audio
 * and communicates via NDJSON over stdio.
 */
export declare class LtcSidecar extends EventEmitter implements TcSourceProvider {
    readonly sourceType: TcSourceType;
    readonly priority = 30;
    private process;
    private available;
    private currentFrames;
    private lastHeartbeat;
    private heartbeatCheckTimer;
    private pythonPath;
    private sidecarPath;
    private shouldRun;
    constructor(pythonPath?: string);
    start(): void;
    stop(): void;
    isAvailable(): boolean;
    getCurrentFrames(): number | null;
    private spawnProcess;
    private handleMessage;
    private checkHeartbeat;
    private setAvailable;
    private killProcess;
}
//# sourceMappingURL=ltc-sidecar.d.ts.map