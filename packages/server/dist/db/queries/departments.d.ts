import type { Department } from '@showpulse/shared';
export declare function getDepartmentsByShow(showId: number): Department[];
export declare function getDepartmentById(id: number): Department | undefined;
export declare function createDepartment(showId: number, name: string, color: string, sortOrder: number): Department;
export declare function updateDepartment(id: number, name: string, color: string, sortOrder: number): Department | undefined;
export declare function deleteDepartment(id: number): boolean;
//# sourceMappingURL=departments.d.ts.map