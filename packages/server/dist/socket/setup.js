import { Server as SocketServer } from 'socket.io';
export function createSocketServer(httpServer) {
    const io = new SocketServer(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
        pingInterval: 10000,
        pingTimeout: 5000,
    });
    return io;
}
//# sourceMappingURL=setup.js.map