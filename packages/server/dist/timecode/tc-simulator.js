import { EventEmitter } from 'events';
/**
 * Timecode simulator for testing and demo mode.
 * Replays timecodes at configurable speed (1x, 10x, 100x).
 */
export class TcSimulator extends EventEmitter {
    sourceType = 'simulator';
    priority = 5;
    fps;
    speed;
    currentFrames = 0;
    timer = null;
    running = false;
    constructor(fps, speed = 1) {
        super();
        this.fps = fps;
        this.speed = speed;
    }
    start() {
        if (this.running)
            return;
        this.running = true;
        // Emit frames at fps * speed rate
        const intervalMs = 1000 / (this.fps * this.speed);
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
    /** Reset to a specific frame */
    seekTo(frames) {
        this.currentFrames = frames;
    }
    /** Set playback speed */
    setSpeed(speed) {
        this.speed = speed;
        if (this.running) {
            this.stop();
            this.start();
        }
    }
}
//# sourceMappingURL=tc-simulator.js.map