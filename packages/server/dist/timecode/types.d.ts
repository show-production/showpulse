import { EventEmitter } from 'events';
import type { TcSourceType } from '@showpulse/shared';
/** All timecode sources implement this interface */
export interface TcSourceProvider extends EventEmitter {
    readonly sourceType: TcSourceType;
    readonly priority: number;
    /** Start producing timecode */
    start(): void;
    /** Stop producing timecode */
    stop(): void;
    /** Whether the source is currently providing valid timecode */
    isAvailable(): boolean;
    /** Get the current frame count, or null if unavailable */
    getCurrentFrames(): number | null;
}
/** Events emitted by TcSourceProvider */
export interface TcSourceEvents {
    /** New timecode frame received */
    frame: (totalFrames: number) => void;
    /** Source availability changed */
    available: (isAvailable: boolean) => void;
}
//# sourceMappingURL=types.d.ts.map