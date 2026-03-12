import { Router } from 'express';
import { z } from 'zod';
import { validatePin, isAuthEnabled } from './pin-middleware.js';
const router = Router();
const loginSchema = z.object({
    pin: z.string().min(1),
});
/** POST /api/auth/login — authenticate with PIN */
router.post('/login', (req, res) => {
    if (!isAuthEnabled()) {
        res.json({ ok: true, message: 'Auth not enabled — dev mode' });
        return;
    }
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'PIN is required' });
        return;
    }
    if (validatePin(parsed.data.pin)) {
        req.session.authenticated = true;
        res.json({ ok: true });
    }
    else {
        res.status(403).json({ error: 'Invalid PIN' });
    }
});
/** POST /api/auth/logout */
router.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ ok: true });
    });
});
/** GET /api/auth/status */
router.get('/status', (req, res) => {
    res.json({
        authEnabled: isAuthEnabled(),
        authenticated: !isAuthEnabled() || !!req.session?.authenticated,
    });
});
export const authRoutes = router;
//# sourceMappingURL=pin-routes.js.map