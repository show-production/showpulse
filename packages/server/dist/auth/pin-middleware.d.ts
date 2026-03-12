import type { Request, Response, NextFunction } from 'express';
declare module 'express-session' {
    interface SessionData {
        authenticated: boolean;
    }
}
/**
 * PIN-based authentication middleware.
 * If SHOWPULSE_ADMIN_PIN is set, admin/write endpoints require a valid session.
 * If no PIN is configured, all requests are allowed (dev mode).
 */
export declare function requireAdmin(req: Request, res: Response, next: NextFunction): void;
/** Check if admin auth is enabled */
export declare function isAuthEnabled(): boolean;
/** Validate a PIN */
export declare function validatePin(pin: string): boolean;
//# sourceMappingURL=pin-middleware.d.ts.map