export interface LogEntry {
    show_id: number;
    event_type: string;
    cue_id?: number | null;
    department_id?: number | null;
    payload?: string | null;
    tc_frames?: number | null;
}
export declare class LogBuffer {
    private buffer;
    private timer;
    private insertStmt;
    start(): void;
    push(entry: LogEntry): void;
    flush(): void;
    stop(): void;
}
//# sourceMappingURL=log-buffer.d.ts.map