import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../auth/pin-middleware.js';
import * as showQueries from '../db/queries/shows.js';
import { DEFAULT_FPS } from '@showpulse/shared';
const router = Router();
const createShowSchema = z.object({
    name: z.string().min(1).max(200),
    fps: z.number().int().min(1).max(120).optional().default(DEFAULT_FPS),
});
const updateShowSchema = z.object({
    name: z.string().min(1).max(200),
    fps: z.number().int().min(1).max(120),
});
/** GET /api/shows */
router.get('/', (_req, res) => {
    res.json(showQueries.getAllShows());
});
/** GET /api/shows/:id */
router.get('/:id', (req, res) => {
    const show = showQueries.getShowById(Number(req.params.id));
    if (!show) {
        res.status(404).json({ error: 'Show not found' });
        return;
    }
    res.json(show);
});
/** POST /api/shows */
router.post('/', requireAdmin, (req, res) => {
    const parsed = createShowSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    const show = showQueries.createShow(parsed.data.name, parsed.data.fps);
    res.status(201).json(show);
});
/** PUT /api/shows/:id */
router.put('/:id', requireAdmin, (req, res) => {
    const parsed = updateShowSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    const show = showQueries.updateShow(Number(req.params.id), parsed.data.name, parsed.data.fps);
    if (!show) {
        res.status(404).json({ error: 'Show not found' });
        return;
    }
    res.json(show);
});
/** DELETE /api/shows/:id */
router.delete('/:id', requireAdmin, (req, res) => {
    const deleted = showQueries.deleteShow(Number(req.params.id));
    if (!deleted) {
        res.status(404).json({ error: 'Show not found' });
        return;
    }
    res.json({ ok: true });
});
export const showRoutes = router;
//# sourceMappingURL=shows.js.map