import { EventEmitter } from 'events';
import { tcToFrames } from '@showpulse/shared';
const MTC_QUARTER_FRAME = 0xf1;
const MTC_TIMEOUT_MS = 2000;
/**
 * MIDI Timecode (MTC) parser.
 * Receives MTC quarter-frame messages via @julusian/midi and reconstructs
 * full timecode, emitting 'frame' events for the Reconciler.
 */
export class MtcParser extends EventEmitter {
    sourceType = 'mtc';
    priority = 20;
    fps;
    midiPortIndex;
    midiInput = null;
    available = false;
    currentFrames = null;
    quarterFrames = new Array(8).fill(0);
    timeoutTimer = null;
    /**
     * @param fps Frame rate for tcToFrames conversion
     * @param midiPortIndex -1 = auto-detect first available, specific number = use that port
     */
    constructor(fps, midiPortIndex = -1) {
        super();
        this.fps = fps;
        this.midiPortIndex = midiPortIndex;
    }
    async start() {
        let midi;
        try {
            midi = await import('@julusian/midi');
        }
        catch {
            console.log('[MtcParser] @julusian/midi not available — skipping MTC source');
            return;
        }
        const Input = midi.Input ?? midi.default?.Input;
        if (!Input) {
            console.log('[MtcParser] @julusian/midi has no Input class — skipping');
            return;
        }
        this.midiInput = new Input();
        const portCount = this.midiInput.getPortCount();
        if (portCount === 0) {
            console.log('[MtcParser] No MIDI input ports found — skipping');
            this.midiInput = null;
            return;
        }
        // Log available ports
        for (let i = 0; i < portCount; i++) {
            console.log(`[MtcParser] MIDI port ${i}: ${this.midiInput.getPortName(i)}`);
        }
        // Select port
        let portIndex;
        if (this.midiPortIndex === -1) {
            portIndex = 0; // auto-detect: use first available
        }
        else if (this.midiPortIndex >= 0 && this.midiPortIndex < portCount) {
            portIndex = this.midiPortIndex;
        }
        else {
            console.log(`[MtcParser] Requested port ${this.midiPortIndex} not found (${portCount} available) — skipping`);
            this.midiInput = null;
            return;
        }
        this.midiInput.openPort(portIndex);
        this.midiInput.ignoreTypes(false, false, false); // receive sysex, timing, active sensing
        this.midiInput.on('message', (_deltaTime, message) => {
            this.onMidiMessage(message);
        });
        console.log(`[MtcParser] Listening on port ${portIndex}: ${this.midiInput.getPortName(portIndex)}`);
    }
    stop() {
        if (this.timeoutTimer) {
            clearTimeout(this.timeoutTimer);
            this.timeoutTimer = null;
        }
        if (this.midiInput) {
            try {
                this.midiInput.closePort();
            }
            catch {
                // port may already be closed
            }
            this.midiInput = null;
        }
        this.quarterFrames.fill(0);
        this.currentFrames = null;
        if (this.available) {
            this.available = false;
            this.emit('available', false);
        }
    }
    isAvailable() {
        return this.available;
    }
    getCurrentFrames() {
        return this.currentFrames;
    }
    onMidiMessage(message) {
        const status = message[0];
        if (status !== MTC_QUARTER_FRAME)
            return;
        const data = message[1];
        const index = (data >> 4) & 0x07;
        const value = data & 0x0f;
        this.quarterFrames[index] = value;
        this.resetTimeout();
        // After receiving all 8 quarter-frames (forward direction: index 7 is last)
        if (index === 7) {
            const f = this.quarterFrames[0] | (this.quarterFrames[1] << 4);
            const s = this.quarterFrames[2] | (this.quarterFrames[3] << 4);
            const m = this.quarterFrames[4] | (this.quarterFrames[5] << 4);
            const h = this.quarterFrames[6] | ((this.quarterFrames[7] & 0x01) << 4);
            const totalFrames = tcToFrames(h, m, s, f, this.fps);
            this.currentFrames = totalFrames;
            this.emit('frame', totalFrames);
            if (!this.available) {
                this.available = true;
                this.emit('available', true);
                console.log('[MtcParser] MTC signal acquired');
            }
        }
    }
    resetTimeout() {
        if (this.timeoutTimer) {
            clearTimeout(this.timeoutTimer);
        }
        this.timeoutTimer = setTimeout(() => {
            if (this.available) {
                this.available = false;
                this.emit('available', false);
                console.log('[MtcParser] MTC signal lost (timeout)');
            }
        }, MTC_TIMEOUT_MS);
    }
}
//# sourceMappingURL=mtc-parser.js.map