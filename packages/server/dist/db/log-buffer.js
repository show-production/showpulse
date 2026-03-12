import { LOG_BUFFER_FLUSH_INTERVAL_MS } from '@showpulse/shared';
import { getDb } from './connection.js';
export class LogBuffer {
    buffer = [];
    timer = null;
    insertStmt = null;
    start() {
        this.timer = setInterval(() => this.flush(), LOG_BUFFER_FLUSH_INTERVAL_MS);
    }
    push(entry) {
        this.buffer.push(entry);
    }
    flush() {
        if (this.buffer.length === 0)
            return;
        const db = getDb();
        if (!this.insertStmt) {
            this.insertStmt = db.prepare(`INSERT INTO show_log (show_id, event_type, cue_id, department_id, payload, tc_frames)
         VALUES (@show_id, @event_type, @cue_id, @department_id, @payload, @tc_frames)`);
        }
        const entries = this.buffer.splice(0);
        const insertMany = db.transaction((rows) => {
            for (const row of rows) {
                this.insertStmt.run({
                    show_id: row.show_id,
                    event_type: row.event_type,
                    cue_id: row.cue_id ?? null,
                    department_id: row.department_id ?? null,
                    payload: row.payload ?? null,
                    tc_frames: row.tc_frames ?? null,
                });
            }
        });
        insertMany(entries);
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.flush();
    }
}
//# sourceMappingURL=log-buffer.js.map