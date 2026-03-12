import type { CueWithDepartments, CueState, CueStateInfo } from '@showpulse/shared';
export interface TrackedCue {
    cue: CueWithDepartments;
    state: CueState;
}
/**
 * Tracks the runtime state of all cues for the active show.
 */
export declare class CueStateManager {
    private cues;
    private fps;
    constructor(fps: number);
    /** Load cues for evaluation — resets all states to 'standby' */
    loadCues(cues: CueWithDepartments[]): void;
    /** Get all tracked cues */
    getAllTracked(): TrackedCue[];
    /** Get tracked cue by id */
    getTracked(cueId: number): TrackedCue | undefined;
    /** Update state for a cue, returns true if state changed */
    setState(cueId: number, newState: CueState): boolean;
    /** Build a CueStateInfo for broadcasting */
    toCueStateInfo(cueId: number, currentFrames: number): CueStateInfo | undefined;
    /** Get all active cue states for a given department */
    getCueStatesForDepartment(departmentId: number, currentFrames: number): CueStateInfo[];
    /** Get all cue states with current countdown */
    getAllCueStates(currentFrames: number): CueStateInfo[];
    /** Get the next upcoming cue (first cue still in standby or warning) */
    getNextCue(currentFrames: number): CueStateInfo | null;
    /** Reset all cue states to standby */
    resetAll(): void;
    /** Force a specific cue to 'go' state (manual trigger) */
    manualGo(cueId: number): boolean;
}
//# sourceMappingURL=state-manager.d.ts.map