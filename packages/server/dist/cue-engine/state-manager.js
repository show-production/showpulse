/**
 * Tracks the runtime state of all cues for the active show.
 */
export class CueStateManager {
    cues = new Map();
    fps;
    constructor(fps) {
        this.fps = fps;
    }
    /** Load cues for evaluation — resets all states to 'standby' */
    loadCues(cues) {
        this.cues.clear();
        for (const cue of cues) {
            this.cues.set(cue.id, { cue, state: 'standby' });
        }
    }
    /** Get all tracked cues */
    getAllTracked() {
        return Array.from(this.cues.values());
    }
    /** Get tracked cue by id */
    getTracked(cueId) {
        return this.cues.get(cueId);
    }
    /** Update state for a cue, returns true if state changed */
    setState(cueId, newState) {
        const tracked = this.cues.get(cueId);
        if (!tracked)
            return false;
        if (tracked.state === newState)
            return false;
        tracked.state = newState;
        return true;
    }
    /** Build a CueStateInfo for broadcasting */
    toCueStateInfo(cueId, currentFrames) {
        const tracked = this.cues.get(cueId);
        if (!tracked)
            return undefined;
        return {
            cue_id: tracked.cue.id,
            cue_number: tracked.cue.cue_number,
            label: tracked.cue.label,
            state: tracked.state,
            tc_trigger: tracked.cue.tc_trigger,
            countdown_frames: Math.max(0, tracked.cue.tc_trigger - currentFrames),
            department_ids: tracked.cue.department_ids,
        };
    }
    /** Get all active cue states for a given department */
    getCueStatesForDepartment(departmentId, currentFrames) {
        const results = [];
        for (const tracked of this.cues.values()) {
            if (tracked.cue.department_ids.includes(departmentId)) {
                const info = this.toCueStateInfo(tracked.cue.id, currentFrames);
                if (info)
                    results.push(info);
            }
        }
        return results;
    }
    /** Get all cue states with current countdown */
    getAllCueStates(currentFrames) {
        const results = [];
        for (const tracked of this.cues.values()) {
            const info = this.toCueStateInfo(tracked.cue.id, currentFrames);
            if (info)
                results.push(info);
        }
        return results;
    }
    /** Get the next upcoming cue (first cue still in standby or warning) */
    getNextCue(currentFrames) {
        let next = null;
        for (const tracked of this.cues.values()) {
            if (tracked.state === 'standby' || tracked.state === 'warning') {
                if (!next || tracked.cue.tc_trigger < next.cue.tc_trigger) {
                    next = tracked;
                }
            }
        }
        if (!next)
            return null;
        return this.toCueStateInfo(next.cue.id, currentFrames);
    }
    /** Reset all cue states to standby */
    resetAll() {
        for (const tracked of this.cues.values()) {
            tracked.state = 'standby';
        }
    }
    /** Force a specific cue to 'go' state (manual trigger) */
    manualGo(cueId) {
        return this.setState(cueId, 'go');
    }
}
//# sourceMappingURL=state-manager.js.map