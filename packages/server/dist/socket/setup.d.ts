import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '@showpulse/shared';
export type TypedSocketServer = SocketServer<ClientToServerEvents, ServerToClientEvents>;
export declare function createSocketServer(httpServer: HttpServer): TypedSocketServer;
//# sourceMappingURL=setup.d.ts.map