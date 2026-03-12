import { framesToTc } from '@showpulse/shared';
import * as showQueries from '../db/queries/shows.js';
import * as deptQueries from '../db/queries/departments.js';
/**
 * Builds the full sync payload for a connecting/reconnecting client.
 */
export function buildFullSyncPayload(reconciler, stateManager, fps, showStatus, activeShowId) {
    const totalFrames = reconciler.getCurrentFrames() ?? 0;
    const tc = framesToTc(totalFrames, fps);
    const source = reconciler.getActiveSourceType() ?? 'internal';
    const show = activeShowId ? showQueries.getShowById(activeShowId) ?? null : null;
    const departments = activeShowId ? deptQueries.getDepartmentsByShow(activeShowId) : [];
    const cueStates = stateManager.getAllCueStates(totalFrames);
    const nextCue = stateManager.getNextCue(totalFrames);
    return {
        timecode: tc,
        totalFrames,
        fps,
        source,
        showStatus,
        show,
        cueStates,
        departments,
        nextCue,
    };
}
/**
 * Send full state sync to a specific socket.
 */
export function sendFullSync(io, socketId, reconciler, stateManager, fps, showStatus, activeShowId) {
    const payload = buildFullSyncPayload(reconciler, stateManager, fps, showStatus, activeShowId);
    io.to(socketId).emit('sync:full-state', payload);
}
//# sourceMappingURL=sync.js.map