import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../auth/pin-middleware.js';
import * as deptQueries from '../db/queries/departments.js';
const router = Router({ mergeParams: true });
const createDepartmentSchema = z.object({
    name: z.string().min(1).max(100),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#3B82F6'),
    sort_order: z.number().int().optional().default(0),
});
const updateDepartmentSchema = z.object({
    name: z.string().min(1).max(100),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    sort_order: z.number().int(),
});
/** GET /api/shows/:showId/departments */
router.get('/', (req, res) => {
    const showId = Number(req.params.showId);
    res.json(deptQueries.getDepartmentsByShow(showId));
});
/** GET /api/shows/:showId/departments/:id */
router.get('/:id', (req, res) => {
    const dept = deptQueries.getDepartmentById(Number(req.params.id));
    if (!dept) {
        res.status(404).json({ error: 'Department not found' });
        return;
    }
    res.json(dept);
});
/** POST /api/shows/:showId/departments */
router.post('/', requireAdmin, (req, res) => {
    const parsed = createDepartmentSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    const showId = Number(req.params.showId);
    const dept = deptQueries.createDepartment(showId, parsed.data.name, parsed.data.color, parsed.data.sort_order);
    res.status(201).json(dept);
});
/** PUT /api/shows/:showId/departments/:id */
router.put('/:id', requireAdmin, (req, res) => {
    const parsed = updateDepartmentSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    const dept = deptQueries.updateDepartment(Number(req.params.id), parsed.data.name, parsed.data.color, parsed.data.sort_order);
    if (!dept) {
        res.status(404).json({ error: 'Department not found' });
        return;
    }
    res.json(dept);
});
/** DELETE /api/shows/:showId/departments/:id */
router.delete('/:id', requireAdmin, (req, res) => {
    const deleted = deptQueries.deleteDepartment(Number(req.params.id));
    if (!deleted) {
        res.status(404).json({ error: 'Department not found' });
        return;
    }
    res.json({ ok: true });
});
export const departmentRoutes = router;
//# sourceMappingURL=departments.js.map