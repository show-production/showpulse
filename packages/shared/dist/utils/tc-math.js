/**
 * Timecode math utilities.
 * All internal timecode is stored as total frames (integer) from 00:00:00:00.
 * Conversion to/from HH:MM:SS:FF happens at API/display boundaries.
 */
/** Convert timecode components to total frame count */
export function tcToFrames(h, m, s, f, fps) {
    return ((h * 3600 + m * 60 + s) * fps + f) | 0;
}
/** Convert timecode components object to total frame count */
export function tcComponentsToFrames(tc, fps) {
    return tcToFrames(tc.h, tc.m, tc.s, tc.f, fps);
}
/** Convert total frame count back to timecode components */
export function framesToTc(totalFrames, fps) {
    const f = totalFrames % fps;
    let remaining = (totalFrames - f) / fps;
    const s = remaining % 60;
    remaining = (remaining - s) / 60;
    const m = remaining % 60;
    const h = (remaining - m) / 60;
    return { h, m, s, f };
}
/** Convert total frames to display string "HH:MM:SS:FF" */
export function tcToString(totalFrames, fps) {
    const { h, m, s, f } = framesToTc(totalFrames, fps);
    return (String(h).padStart(2, '0') + ':' +
        String(m).padStart(2, '0') + ':' +
        String(s).padStart(2, '0') + ':' +
        String(f).padStart(2, '0'));
}
/** Parse a "HH:MM:SS:FF" string to total frames */
export function parseTcString(str, fps) {
    const parts = str.split(':');
    if (parts.length !== 4) {
        throw new Error(`Invalid timecode string: "${str}" — expected HH:MM:SS:FF`);
    }
    const [h, m, s, f] = parts.map(Number);
    if ([h, m, s, f].some(isNaN)) {
        throw new Error(`Invalid timecode string: "${str}" — non-numeric component`);
    }
    return tcToFrames(h, m, s, f, fps);
}
/** Calculate the difference in frames between two timecodes */
export function frameDiff(a, b) {
    return a - b;
}
/** Check if a frame count is within a window of another */
export function isWithinWindow(current, target, windowFrames) {
    const diff = target - current;
    return diff >= 0 && diff <= windowFrames;
}
//# sourceMappingURL=tc-math.js.map