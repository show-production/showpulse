import { EventEmitter } from 'events';
/**
 * Event-driven cue evaluator.
 * Subscribes to the reconciler's `tc:update` event and evaluates all cues
 * synchronously on every new timecode frame. No polling.
 *
 * Emits:
 * - `cue:state-change` — when any cue transitions state
 * - `cue:go` — when a cue reaches its trigger point
 */
export class CueEvaluator extends EventEmitter {
    reconciler;
    stateManager;
    fps;
    enabled = false;
    constructor(reconciler, stateManager, fps) {
        super();
        this.reconciler = reconciler;
        this.stateManager = stateManager;
        this.fps = fps;
    }
    /** Start listening for timecode updates */
    start() {
        if (this.enabled)
            return;
        this.enabled = true;
        this.reconciler.on('tc:update', this.onTcUpdate);
    }
    /** Stop listening */
    stop() {
        this.enabled = false;
        this.reconciler.off('tc:update', this.onTcUpdate);
    }
    /** Evaluate a single cue and return new state (or null if no change) */
    evaluateCue(tracked, currentFrames) {
        const { cue, state } = tracked;
        // Already fired — no further transitions
        if (state === 'go' || state === 'done') {
            // Transition from 'go' to 'done' after we've passed the trigger point
            if (state === 'go' && currentFrames > cue.tc_trigger) {
                return 'done';
            }
            return null;
        }
        // Check if we've reached or passed the trigger point
        if (currentFrames >= cue.tc_trigger) {
            return 'go';
        }
        // Check warning window
        const warningFrames = cue.warning_seconds * this.fps;
        if (currentFrames >= cue.tc_trigger - warningFrames) {
            if (state !== 'warning') {
                return 'warning';
            }
        }
        return null;
    }
    /** Handle manual GO for a specific cue */
    manualGo(cueId) {
        if (this.stateManager.manualGo(cueId)) {
            const currentFrames = this.reconciler.getCurrentFrames() ?? 0;
            const info = this.stateManager.toCueStateInfo(cueId, currentFrames);
            if (info) {
                this.emit('cue:state-change', info);
                this.emit('cue:go', info);
            }
        }
    }
    onTcUpdate = (event) => {
        const { totalFrames } = event;
        for (const tracked of this.stateManager.getAllTracked()) {
            const newState = this.evaluateCue(tracked, totalFrames);
            if (newState !== null) {
                const changed = this.stateManager.setState(tracked.cue.id, newState);
                if (changed) {
                    const info = this.stateManager.toCueStateInfo(tracked.cue.id, totalFrames);
                    if (info) {
                        this.emit('cue:state-change', info);
                        if (newState === 'go') {
                            this.emit('cue:go', info);
                        }
                    }
                }
            }
        }
    };
}
//# sourceMappingURL=evaluator.js.map