/**
 * mDNS service registration for local network discovery.
 * Uses bonjour-service to register an HTTP service so crew devices
 * can find the server at e.g. showpulse.local
 */
export declare function registerMdns(name: string, port: number): () => void;
//# sourceMappingURL=mdns.d.ts.map