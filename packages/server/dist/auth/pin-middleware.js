import { config } from '../config.js';
/**
 * PIN-based authentication middleware.
 * If SHOWPULSE_ADMIN_PIN is set, admin/write endpoints require a valid session.
 * If no PIN is configured, all requests are allowed (dev mode).
 */
export function requireAdmin(req, res, next) {
    // No PIN configured — dev mode, allow everything
    if (!config.adminPin) {
        next();
        return;
    }
    // Check session
    if (req.session?.authenticated) {
        next();
        return;
    }
    res.status(401).json({ error: 'Authentication required' });
}
/** Check if admin auth is enabled */
export function isAuthEnabled() {
    return !!config.adminPin;
}
/** Validate a PIN */
export function validatePin(pin) {
    return config.adminPin !== '' && pin === config.adminPin;
}
//# sourceMappingURL=pin-middleware.js.map