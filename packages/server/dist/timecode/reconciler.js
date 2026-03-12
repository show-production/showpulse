import { EventEmitter } from 'events';
import { framesToTc } from '@showpulse/shared';
/**
 * Timecode Reconciler — selects the highest-priority available source
 * and emits `tc:update` on every new frame. The cue evaluator subscribes
 * to this event (no polling).
 *
 * Priority: LTC (30) > MTC (20) > Internal (10) > Simulator (5)
 */
export class Reconciler extends EventEmitter {
    sources = [];
    activeSource = null;
    fps;
    lastFrames = null;
    constructor(fps) {
        super();
        this.fps = fps;
    }
    /** Register a timecode source */
    addSource(source) {
        this.sources.push(source);
        this.sources.sort((a, b) => b.priority - a.priority);
        // Listen for frames from this source
        source.on('frame', (totalFrames) => {
            this.onSourceFrame(source, totalFrames);
        });
        // Listen for availability changes to re-evaluate active source
        source.on('available', () => {
            this.selectBestSource();
        });
    }
    /** Remove a timecode source */
    removeSource(source) {
        source.removeAllListeners('frame');
        source.removeAllListeners('available');
        this.sources = this.sources.filter((s) => s !== source);
        if (this.activeSource === source) {
            this.activeSource = null;
            this.selectBestSource();
        }
    }
    /** Get the currently active source type */
    getActiveSourceType() {
        return this.activeSource?.sourceType ?? null;
    }
    /** Get the current total frames */
    getCurrentFrames() {
        return this.lastFrames;
    }
    /** Get current timecode as components */
    getCurrentTc() {
        if (this.lastFrames === null)
            return null;
        return framesToTc(this.lastFrames, this.fps);
    }
    onSourceFrame(source, totalFrames) {
        // Only accept frames from the active (highest-priority available) source
        if (source !== this.activeSource) {
            // Check if this source should take over
            if (this.shouldTakeOver(source)) {
                this.activeSource = source;
                console.log(`[Reconciler] Switched to ${source.sourceType} (priority ${source.priority})`);
            }
            else {
                return;
            }
        }
        // Deduplicate — don't emit if frame hasn't changed
        if (totalFrames === this.lastFrames)
            return;
        this.lastFrames = totalFrames;
        const tc = framesToTc(totalFrames, this.fps);
        const event = {
            totalFrames,
            tc,
            source: source.sourceType,
        };
        this.emit('tc:update', event);
    }
    shouldTakeOver(source) {
        if (!source.isAvailable())
            return false;
        if (!this.activeSource)
            return true;
        if (!this.activeSource.isAvailable())
            return true;
        return source.priority > this.activeSource.priority;
    }
    selectBestSource() {
        const best = this.sources.find((s) => s.isAvailable()) ?? null;
        if (best !== this.activeSource) {
            this.activeSource = best;
            if (best) {
                console.log(`[Reconciler] Active source: ${best.sourceType} (priority ${best.priority})`);
            }
            else {
                console.log('[Reconciler] No timecode source available');
            }
        }
    }
}
//# sourceMappingURL=reconciler.js.map