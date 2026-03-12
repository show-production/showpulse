/**
 * mDNS service registration for local network discovery.
 * Uses bonjour-service to register an HTTP service so crew devices
 * can find the server at e.g. showpulse.local
 */
import { Bonjour } from 'bonjour-service';
export function registerMdns(name, port) {
    try {
        const bonjour = new Bonjour();
        bonjour.publish({ name, type: 'http', port });
        console.log(`[mDNS] Registered "${name}" on port ${port}`);
        return () => {
            bonjour.unpublishAll();
            bonjour.destroy();
            console.log('[mDNS] Unregistered');
        };
    }
    catch (err) {
        console.warn('[mDNS] Failed to register — continuing without mDNS:', err);
        return () => { };
    }
}
//# sourceMappingURL=mdns.js.map