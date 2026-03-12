import { Router } from 'express';
import { framesToTc } from '@showpulse/shared';
export function createTimecodeRoutes(reconciler, fps) {
    const router = Router();
    /** GET /api/timecode — current timecode state */
    router.get('/', (_req, res) => {
        const frames = reconciler.getCurrentFrames();
        const source = reconciler.getActiveSourceType();
        if (frames === null) {
            res.json({ tc: null, totalFrames: null, source: null, fps });
            return;
        }
        res.json({
            tc: framesToTc(frames, fps),
            totalFrames: frames,
            source,
            fps,
        });
    });
    return router;
}
//# sourceMappingURL=timecode.js.map