import type { TypedSocketServer } from './setup.js';
import type { Reconciler } from '../timecode/reconciler.js';
import type { CueEvaluator } from '../cue-engine/evaluator.js';
import type { CueStateManager } from '../cue-engine/state-manager.js';
import type { ShowStatus } from '@showpulse/shared';
interface HandlerContext {
    io: TypedSocketServer;
    reconciler: Reconciler;
    evaluator: CueEvaluator;
    stateManager: CueStateManager;
    fps: number;
    getShowStatus: () => ShowStatus;
    setShowStatus: (status: ShowStatus) => void;
    getActiveShowId: () => number | null;
}
export declare function registerSocketHandlers(ctx: HandlerContext): void;
export {};
//# sourceMappingURL=handlers.d.ts.map