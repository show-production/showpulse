import { EventEmitter } from 'events';
import type { TcSourceProvider } from './types.js';
import type { TcSourceType } from '@showpulse/shared';
/**
 * Timecode simulator for testing and demo mode.
 * Replays timecodes at configurable speed (1x, 10x, 100x).
 */
export declare class TcSimulator extends EventEmitter implements TcSourceProvider {
    readonly sourceType: TcSourceType;
    readonly priority = 5;
    private fps;
    private speed;
    private currentFrames;
    private timer;
    private running;
    constructor(fps: number, speed?: number);
    start(): void;
    stop(): void;
    isAvailable(): boolean;
    getCurrentFrames(): number | null;
    /** Reset to a specific frame */
    seekTo(frames: number): void;
    /** Set playback speed */
    setSpeed(speed: number): void;
}
//# sourceMappingURL=tc-simulator.d.ts.map