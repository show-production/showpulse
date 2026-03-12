import { getDb } from '../connection.js';
export function getDepartmentsByShow(showId) {
    return getDb()
        .prepare('SELECT * FROM departments WHERE show_id = ? ORDER BY sort_order')
        .all(showId);
}
export function getDepartmentById(id) {
    return getDb().prepare('SELECT * FROM departments WHERE id = ?').get(id);
}
export function createDepartment(showId, name, color, sortOrder) {
    const result = getDb().prepare('INSERT INTO departments (show_id, name, color, sort_order) VALUES (?, ?, ?, ?)').run(showId, name, color, sortOrder);
    return getDepartmentById(Number(result.lastInsertRowid));
}
export function updateDepartment(id, name, color, sortOrder) {
    getDb().prepare('UPDATE departments SET name = ?, color = ?, sort_order = ? WHERE id = ?').run(name, color, sortOrder, id);
    return getDepartmentById(id);
}
export function deleteDepartment(id) {
    const result = getDb().prepare('DELETE FROM departments WHERE id = ?').run(id);
    return result.changes > 0;
}
//# sourceMappingURL=departments.js.map