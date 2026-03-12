import type { Show } from '@showpulse/shared';
export declare function getAllShows(): Show[];
export declare function getShowById(id: number): Show | undefined;
export declare function createShow(name: string, fps: number): Show;
export declare function updateShow(id: number, name: string, fps: number): Show | undefined;
export declare function deleteShow(id: number): boolean;
//# sourceMappingURL=shows.d.ts.map