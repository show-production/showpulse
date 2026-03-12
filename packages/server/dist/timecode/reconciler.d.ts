import { EventEmitter } from 'events';
import type { TcSourceProvider } from './types.js';
import type { TcSourceType, TcFrame } from '@showpulse/shared';
export interface TcUpdateEvent {
    totalFrames: number;
    tc: TcFrame;
    source: TcSourceType;
}
/**
 * Timecode Reconciler — selects the highest-priority available source
 * and emits `tc:update` on every new frame. The cue evaluator subscribes
 * to this event (no polling).
 *
 * Priority: LTC (30) > MTC (20) > Internal (10) > Simulator (5)
 */
export declare class Reconciler extends EventEmitter {
    private sources;
    private activeSource;
    private fps;
    private lastFrames;
    constructor(fps: number);
    /** Register a timecode source */
    addSource(source: TcSourceProvider): void;
    /** Remove a timecode source */
    removeSource(source: TcSourceProvider): void;
    /** Get the currently active source type */
    getActiveSourceType(): TcSourceType | null;
    /** Get the current total frames */
    getCurrentFrames(): number | null;
    /** Get current timecode as components */
    getCurrentTc(): TcFrame | null;
    private onSourceFrame;
    private shouldTakeOver;
    private selectBestSource;
}
//# sourceMappingURL=reconciler.d.ts.map