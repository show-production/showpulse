/** Timecode frame components for API/WebSocket transport */
export interface TcFrame {
    h: number;
    m: number;
    s: number;
    f: number;
}
/** Timecode source types */
export type TcSourceType = 'internal' | 'mtc' | 'ltc' | 'simulator';
/** Show status */
export type ShowStatus = 'idle' | 'running' | 'paused' | 'stopped';
/** Cue state in the engine */
export type CueState = 'standby' | 'warning' | 'go' | 'done';
export interface Show {
    id: number;
    name: string;
    fps: number;
    created_at: string;
    updated_at: string;
}
export interface Department {
    id: number;
    show_id: number;
    name: string;
    color: string;
    sort_order: number;
}
export interface CueGroup {
    id: number;
    show_id: number;
    name: string;
    sort_order: number;
}
export interface Cue {
    id: number;
    show_id: number;
    group_id: number | null;
    cue_number: string;
    label: string;
    tc_trigger: number;
    warning_seconds: number;
    sort_order: number;
}
/** Cue with its department assignments */
export interface CueWithDepartments extends Cue {
    department_ids: number[];
}
/** A junction row linking cues to departments */
export interface CueDepartment {
    cue_id: number;
    department_id: number;
}
/** Active cue state broadcasted to clients */
export interface CueStateInfo {
    cue_id: number;
    cue_number: string;
    label: string;
    state: CueState;
    tc_trigger: number;
    countdown_frames: number;
    department_ids: number[];
}
/** Full sync payload sent on reconnect */
export interface FullSyncPayload {
    timecode: TcFrame;
    totalFrames: number;
    fps: number;
    source: TcSourceType;
    showStatus: ShowStatus;
    show: Show | null;
    cueStates: CueStateInfo[];
    departments: Department[];
    nextCue: CueStateInfo | null;
}
export interface ServerToClientEvents {
    'tc:frame': (data: {
        tc: TcFrame;
        totalFrames: number;
        source: TcSourceType;
    }) => void;
    'cue:state-change': (data: CueStateInfo) => void;
    'cue:go': (data: CueStateInfo) => void;
    'sync:full-state': (data: FullSyncPayload) => void;
    'show:status': (data: {
        status: ShowStatus;
    }) => void;
    'ltc:status': (data: {
        available: boolean;
    }) => void;
}
export interface ClientToServerEvents {
    'join:department': (departmentId: number) => void;
    'leave:department': (departmentId: number) => void;
    'cue:manual-go': (cueId: number) => void;
    'show:set-status': (status: ShowStatus) => void;
}
export interface CreateShowRequest {
    name: string;
    fps?: number;
}
export interface CreateDepartmentRequest {
    name: string;
    color?: string;
    sort_order?: number;
}
export interface CreateCueRequest {
    group_id?: number | null;
    cue_number: string;
    label: string;
    tc_trigger: string;
    warning_seconds?: number;
    department_ids: number[];
    sort_order?: number;
}
export interface CreateCueGroupRequest {
    name: string;
    sort_order?: number;
}
//# sourceMappingURL=index.d.ts.map