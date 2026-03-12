import { EventEmitter } from 'events';
import type { TcSourceProvider } from './types.js';
import type { TcSourceType } from '@showpulse/shared';
/**
 * Internal freerunning timecode clock.
 * Generates frames at the configured FPS using a high-resolution timer.
 */
export declare class InternalClock extends EventEmitter implements TcSourceProvider {
    readonly sourceType: TcSourceType;
    readonly priority = 10;
    private fps;
    private currentFrames;
    private timer;
    private running;
    constructor(fps: number);
    start(): void;
    stop(): void;
    isAvailable(): boolean;
    getCurrentFrames(): number | null;
    /** Reset the clock to zero */
    reset(): void;
    /** Set the clock to a specific frame */
    setFrames(frames: number): void;
}
//# sourceMappingURL=internal-clock.d.ts.map