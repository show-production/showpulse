import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../auth/pin-middleware.js';
import * as cueQueries from '../db/queries/cues.js';
import { parseTcString, tcToString, DEFAULT_FPS, DEFAULT_WARNING_SECONDS } from '@showpulse/shared';
import * as showQueries from '../db/queries/shows.js';
const router = Router({ mergeParams: true });
const TC_PATTERN = /^\d{2}:\d{2}:\d{2}:\d{2}$/;
const createCueSchema = z.object({
    group_id: z.number().int().nullable().optional().default(null),
    cue_number: z.string().min(1).max(20),
    label: z.string().min(1).max(200),
    tc_trigger: z.string().regex(TC_PATTERN, 'Must be HH:MM:SS:FF format'),
    warning_seconds: z.number().int().min(0).optional().default(DEFAULT_WARNING_SECONDS),
    department_ids: z.array(z.number().int()).min(1),
    sort_order: z.number().int().optional().default(0),
});
const updateCueSchema = z.object({
    group_id: z.number().int().nullable(),
    cue_number: z.string().min(1).max(20),
    label: z.string().min(1).max(200),
    tc_trigger: z.string().regex(TC_PATTERN, 'Must be HH:MM:SS:FF format'),
    warning_seconds: z.number().int().min(0),
    department_ids: z.array(z.number().int()).min(1),
    sort_order: z.number().int(),
});
// --- Cue Groups ---
const createGroupSchema = z.object({
    name: z.string().min(1).max(100),
    sort_order: z.number().int().optional().default(0),
});
/** GET /api/shows/:showId/cue-groups */
router.get('/groups', (req, res) => {
    const showId = Number(req.params.showId);
    res.json(cueQueries.getCueGroupsByShow(showId));
});
/** POST /api/shows/:showId/cue-groups */
router.post('/groups', requireAdmin, (req, res) => {
    const parsed = createGroupSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    const showId = Number(req.params.showId);
    const group = cueQueries.createCueGroup(showId, parsed.data.name, parsed.data.sort_order);
    res.status(201).json(group);
});
/** DELETE /api/shows/:showId/cue-groups/:id */
router.delete('/groups/:id', requireAdmin, (req, res) => {
    const deleted = cueQueries.deleteCueGroup(Number(req.params.id));
    if (!deleted) {
        res.status(404).json({ error: 'Cue group not found' });
        return;
    }
    res.json({ ok: true });
});
// --- Cues ---
function getFpsForShow(showId) {
    const show = showQueries.getShowById(showId);
    return show?.fps ?? DEFAULT_FPS;
}
/** GET /api/shows/:showId/cues */
router.get('/', (req, res) => {
    const showId = Number(req.params.showId);
    const fps = getFpsForShow(showId);
    const cues = cueQueries.getCuesByShow(showId);
    // Add string representation of tc_trigger for API consumers
    const result = cues.map((c) => ({
        ...c,
        tc_trigger_display: tcToString(c.tc_trigger, fps),
    }));
    res.json(result);
});
/** GET /api/shows/:showId/cues/:id */
router.get('/:id', (req, res) => {
    const cue = cueQueries.getCueById(Number(req.params.id));
    if (!cue) {
        res.status(404).json({ error: 'Cue not found' });
        return;
    }
    const fps = getFpsForShow(cue.show_id);
    res.json({ ...cue, tc_trigger_display: tcToString(cue.tc_trigger, fps) });
});
/** POST /api/shows/:showId/cues */
router.post('/', requireAdmin, (req, res) => {
    const parsed = createCueSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    const showId = Number(req.params.showId);
    const fps = getFpsForShow(showId);
    const tcFrames = parseTcString(parsed.data.tc_trigger, fps);
    const cue = cueQueries.createCue(showId, parsed.data.group_id, parsed.data.cue_number, parsed.data.label, tcFrames, parsed.data.warning_seconds, parsed.data.sort_order, parsed.data.department_ids);
    res.status(201).json({ ...cue, tc_trigger_display: tcToString(cue.tc_trigger, fps) });
});
/** PUT /api/shows/:showId/cues/:id */
router.put('/:id', requireAdmin, (req, res) => {
    const parsed = updateCueSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    const showId = Number(req.params.showId);
    const fps = getFpsForShow(showId);
    const tcFrames = parseTcString(parsed.data.tc_trigger, fps);
    const cue = cueQueries.updateCue(Number(req.params.id), parsed.data.group_id, parsed.data.cue_number, parsed.data.label, tcFrames, parsed.data.warning_seconds, parsed.data.sort_order, parsed.data.department_ids);
    if (!cue) {
        res.status(404).json({ error: 'Cue not found' });
        return;
    }
    res.json({ ...cue, tc_trigger_display: tcToString(cue.tc_trigger, fps) });
});
/** DELETE /api/shows/:showId/cues/:id */
router.delete('/:id', requireAdmin, (req, res) => {
    const deleted = cueQueries.deleteCue(Number(req.params.id));
    if (!deleted) {
        res.status(404).json({ error: 'Cue not found' });
        return;
    }
    res.json({ ok: true });
});
export const cueRoutes = router;
//# sourceMappingURL=cues.js.map