import { EventEmitter } from 'events';
/**
 * Internal freerunning timecode clock.
 * Generates frames at the configured FPS using a high-resolution timer.
 */
export class InternalClock extends EventEmitter {
    sourceType = 'internal';
    priority = 10;
    fps;
    currentFrames = 0;
    timer = null;
    running = false;
    constructor(fps) {
        super();
        this.fps = fps;
    }
    start() {
        if (this.running)
            return;
        this.running = true;
        const intervalMs = 1000 / this.fps;
        this.timer = setInterval(() => {
            this.currentFrames++;
            this.emit('frame', this.currentFrames);
        }, intervalMs);
        this.emit('available', true);
    }
    stop() {
        if (!this.running)
            return;
        this.running = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.emit('available', false);
    }
    isAvailable() {
        return this.running;
    }
    getCurrentFrames() {
        return this.running ? this.currentFrames : null;
    }
    /** Reset the clock to zero */
    reset() {
        this.currentFrames = 0;
    }
    /** Set the clock to a specific frame */
    setFrames(frames) {
        this.currentFrames = frames;
    }
}
//# sourceMappingURL=internal-clock.js.map