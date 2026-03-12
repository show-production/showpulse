import type { TypedSocketServer } from './setup.js';
import type { Reconciler } from '../timecode/reconciler.js';
import type { CueStateManager } from '../cue-engine/state-manager.js';
import type { FullSyncPayload, ShowStatus } from '@showpulse/shared';
/**
 * Builds the full sync payload for a connecting/reconnecting client.
 */
export declare function buildFullSyncPayload(reconciler: Reconciler, stateManager: CueStateManager, fps: number, showStatus: ShowStatus, activeShowId: number | null): FullSyncPayload;
/**
 * Send full state sync to a specific socket.
 */
export declare function sendFullSync(io: TypedSocketServer, socketId: string, reconciler: Reconciler, stateManager: CueStateManager, fps: number, showStatus: ShowStatus, activeShowId: number | null): void;
//# sourceMappingURL=sync.d.ts.map