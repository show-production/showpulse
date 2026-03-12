import { EventEmitter } from 'events';
import type { TcSourceProvider } from './types.js';
import type { TcSourceType } from '@showpulse/shared';
/**
 * MIDI Timecode (MTC) parser.
 * Receives MTC quarter-frame messages via @julusian/midi and reconstructs
 * full timecode, emitting 'frame' events for the Reconciler.
 */
export declare class MtcParser extends EventEmitter implements TcSourceProvider {
    readonly sourceType: TcSourceType;
    readonly priority = 20;
    private fps;
    private midiPortIndex;
    private midiInput;
    private available;
    private currentFrames;
    private quarterFrames;
    private timeoutTimer;
    /**
     * @param fps Frame rate for tcToFrames conversion
     * @param midiPortIndex -1 = auto-detect first available, specific number = use that port
     */
    constructor(fps: number, midiPortIndex?: number);
    start(): Promise<void>;
    stop(): void;
    isAvailable(): boolean;
    getCurrentFrames(): number | null;
    private onMidiMessage;
    private resetTimeout;
}
//# sourceMappingURL=mtc-parser.d.ts.map