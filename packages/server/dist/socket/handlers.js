import { sendFullSync } from './sync.js';
export function registerSocketHandlers(ctx) {
    const { io, reconciler, evaluator, stateManager, fps } = ctx;
    io.on('connection', (socket) => {
        console.log(`[Socket] Client connected: ${socket.id}`);
        // Send full state on connect (handles reconnection recovery)
        sendFullSync(io, socket.id, reconciler, stateManager, fps, ctx.getShowStatus(), ctx.getActiveShowId());
        // Join a department room
        socket.on('join:department', (departmentId) => {
            const room = `dept:${departmentId}`;
            socket.join(room);
            console.log(`[Socket] ${socket.id} joined ${room}`);
        });
        // Leave a department room
        socket.on('leave:department', (departmentId) => {
            const room = `dept:${departmentId}`;
            socket.leave(room);
            console.log(`[Socket] ${socket.id} left ${room}`);
        });
        // Manual GO trigger
        socket.on('cue:manual-go', (cueId) => {
            // TODO: Check auth via socket session in Phase 1c
            evaluator.manualGo(cueId);
        });
        // Set show status
        socket.on('show:set-status', (status) => {
            // TODO: Check auth via socket session in Phase 1c
            ctx.setShowStatus(status);
            io.emit('show:status', { status });
        });
        socket.on('disconnect', () => {
            console.log(`[Socket] Client disconnected: ${socket.id}`);
        });
    });
}
//# sourceMappingURL=handlers.js.map