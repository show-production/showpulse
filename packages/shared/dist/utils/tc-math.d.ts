/**
 * Timecode math utilities.
 * All internal timecode is stored as total frames (integer) from 00:00:00:00.
 * Conversion to/from HH:MM:SS:FF happens at API/display boundaries.
 */
export interface TcComponents {
    h: number;
    m: number;
    s: number;
    f: number;
}
/** Convert timecode components to total frame count */
export declare function tcToFrames(h: number, m: number, s: number, f: number, fps: number): number;
/** Convert timecode components object to total frame count */
export declare function tcComponentsToFrames(tc: TcComponents, fps: number): number;
/** Convert total frame count back to timecode components */
export declare function framesToTc(totalFrames: number, fps: number): TcComponents;
/** Convert total frames to display string "HH:MM:SS:FF" */
export declare function tcToString(totalFrames: number, fps: number): string;
/** Parse a "HH:MM:SS:FF" string to total frames */
export declare function parseTcString(str: string, fps: number): number;
/** Calculate the difference in frames between two timecodes */
export declare function frameDiff(a: number, b: number): number;
/** Check if a frame count is within a window of another */
export declare function isWithinWindow(current: number, target: number, windowFrames: number): boolean;
//# sourceMappingURL=tc-math.d.ts.map