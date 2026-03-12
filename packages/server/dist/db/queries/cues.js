import { getDb } from '../connection.js';
// --- Cue Groups ---
export function getCueGroupsByShow(showId) {
    return getDb()
        .prepare('SELECT * FROM cue_groups WHERE show_id = ? ORDER BY sort_order')
        .all(showId);
}
export function createCueGroup(showId, name, sortOrder) {
    const result = getDb().prepare('INSERT INTO cue_groups (show_id, name, sort_order) VALUES (?, ?, ?)').run(showId, name, sortOrder);
    return getDb().prepare('SELECT * FROM cue_groups WHERE id = ?').get(Number(result.lastInsertRowid));
}
export function updateCueGroup(id, name, sortOrder) {
    getDb().prepare('UPDATE cue_groups SET name = ?, sort_order = ? WHERE id = ?').run(name, sortOrder, id);
    return getDb().prepare('SELECT * FROM cue_groups WHERE id = ?').get(id);
}
export function deleteCueGroup(id) {
    const result = getDb().prepare('DELETE FROM cue_groups WHERE id = ?').run(id);
    return result.changes > 0;
}
// --- Cues ---
export function getCuesByShow(showId) {
    const cues = getDb()
        .prepare('SELECT * FROM cues WHERE show_id = ? ORDER BY sort_order, tc_trigger')
        .all(showId);
    const deptStmt = getDb().prepare('SELECT department_id FROM cue_departments WHERE cue_id = ?');
    return cues.map((cue) => {
        const depts = deptStmt.all(cue.id);
        return {
            ...cue,
            department_ids: depts.map((d) => d.department_id),
        };
    });
}
export function getCueById(id) {
    const cue = getDb().prepare('SELECT * FROM cues WHERE id = ?').get(id);
    if (!cue)
        return undefined;
    const depts = getDb()
        .prepare('SELECT department_id FROM cue_departments WHERE cue_id = ?')
        .all(id);
    return {
        ...cue,
        department_ids: depts.map((d) => d.department_id),
    };
}
export function createCue(showId, groupId, cueNumber, label, tcTrigger, warningSeconds, sortOrder, departmentIds) {
    const db = getDb();
    const result = db.transaction(() => {
        const res = db.prepare(`INSERT INTO cues (show_id, group_id, cue_number, label, tc_trigger, warning_seconds, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`).run(showId, groupId, cueNumber, label, tcTrigger, warningSeconds, sortOrder);
        const cueId = Number(res.lastInsertRowid);
        const insertDept = db.prepare('INSERT INTO cue_departments (cue_id, department_id) VALUES (?, ?)');
        for (const deptId of departmentIds) {
            insertDept.run(cueId, deptId);
        }
        return cueId;
    })();
    return getCueById(result);
}
export function updateCue(id, groupId, cueNumber, label, tcTrigger, warningSeconds, sortOrder, departmentIds) {
    const db = getDb();
    db.transaction(() => {
        db.prepare(`UPDATE cues SET group_id = ?, cue_number = ?, label = ?, tc_trigger = ?, warning_seconds = ?, sort_order = ?
       WHERE id = ?`).run(groupId, cueNumber, label, tcTrigger, warningSeconds, sortOrder, id);
        // Replace department assignments
        db.prepare('DELETE FROM cue_departments WHERE cue_id = ?').run(id);
        const insertDept = db.prepare('INSERT INTO cue_departments (cue_id, department_id) VALUES (?, ?)');
        for (const deptId of departmentIds) {
            insertDept.run(id, deptId);
        }
    })();
    return getCueById(id);
}
export function deleteCue(id) {
    const result = getDb().prepare('DELETE FROM cues WHERE id = ?').run(id);
    return result.changes > 0;
}
/** Get all cues for a show, ordered by tc_trigger — used by the cue evaluator */
export function getCuesForEvaluation(showId) {
    const cues = getDb()
        .prepare('SELECT * FROM cues WHERE show_id = ? ORDER BY tc_trigger')
        .all(showId);
    const deptStmt = getDb().prepare('SELECT department_id FROM cue_departments WHERE cue_id = ?');
    return cues.map((cue) => {
        const depts = deptStmt.all(cue.id);
        return {
            ...cue,
            department_ids: depts.map((d) => d.department_id),
        };
    });
}
//# sourceMappingURL=cues.js.map