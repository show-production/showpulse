import { EventEmitter } from 'events';
import type { Reconciler } from '../timecode/reconciler.js';
import { CueStateManager, type TrackedCue } from './state-manager.js';
import type { CueState } from '@showpulse/shared';
/**
 * Event-driven cue evaluator.
 * Subscribes to the reconciler's `tc:update` event and evaluates all cues
 * synchronously on every new timecode frame. No polling.
 *
 * Emits:
 * - `cue:state-change` — when any cue transitions state
 * - `cue:go` — when a cue reaches its trigger point
 */
export declare class CueEvaluator extends EventEmitter {
    private reconciler;
    private stateManager;
    private fps;
    private enabled;
    constructor(reconciler: Reconciler, stateManager: CueStateManager, fps: number);
    /** Start listening for timecode updates */
    start(): void;
    /** Stop listening */
    stop(): void;
    /** Evaluate a single cue and return new state (or null if no change) */
    evaluateCue(tracked: TrackedCue, currentFrames: number): CueState | null;
    /** Handle manual GO for a specific cue */
    manualGo(cueId: number): void;
    private onTcUpdate;
}
//# sourceMappingURL=evaluator.d.ts.map