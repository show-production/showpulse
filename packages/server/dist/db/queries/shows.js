import { getDb } from '../connection.js';
export function getAllShows() {
    return getDb().prepare('SELECT * FROM shows ORDER BY created_at DESC').all();
}
export function getShowById(id) {
    return getDb().prepare('SELECT * FROM shows WHERE id = ?').get(id);
}
export function createShow(name, fps) {
    const result = getDb().prepare('INSERT INTO shows (name, fps) VALUES (?, ?)').run(name, fps);
    return getShowById(Number(result.lastInsertRowid));
}
export function updateShow(id, name, fps) {
    getDb().prepare("UPDATE shows SET name = ?, fps = ?, updated_at = datetime('now') WHERE id = ?").run(name, fps, id);
    return getShowById(id);
}
export function deleteShow(id) {
    const result = getDb().prepare('DELETE FROM shows WHERE id = ?').run(id);
    return result.changes > 0;
}
//# sourceMappingURL=shows.js.map