import type { CueWithDepartments, CueGroup } from '@showpulse/shared';
export declare function getCueGroupsByShow(showId: number): CueGroup[];
export declare function createCueGroup(showId: number, name: string, sortOrder: number): CueGroup;
export declare function updateCueGroup(id: number, name: string, sortOrder: number): CueGroup | undefined;
export declare function deleteCueGroup(id: number): boolean;
export declare function getCuesByShow(showId: number): CueWithDepartments[];
export declare function getCueById(id: number): CueWithDepartments | undefined;
export declare function createCue(showId: number, groupId: number | null, cueNumber: string, label: string, tcTrigger: number, warningSeconds: number, sortOrder: number, departmentIds: number[]): CueWithDepartments;
export declare function updateCue(id: number, groupId: number | null, cueNumber: string, label: string, tcTrigger: number, warningSeconds: number, sortOrder: number, departmentIds: number[]): CueWithDepartments | undefined;
export declare function deleteCue(id: number): boolean;
/** Get all cues for a show, ordered by tc_trigger — used by the cue evaluator */
export declare function getCuesForEvaluation(showId: number): CueWithDepartments[];
//# sourceMappingURL=cues.d.ts.map