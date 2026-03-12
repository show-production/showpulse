import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
let db = null;
export function getDb() {
    if (!db) {
        throw new Error('Database not initialized — call initDb() first');
    }
    return db;
}
export function initDb() {
    // Ensure data directory exists
    const dbDir = path.dirname(config.dbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    db = new Database(config.dbPath);
    // Enable WAL mode for concurrent reads during writes
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    // Run schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    // Execute each statement separately (better-sqlite3 exec handles multiple)
    db.exec(schema);
    return db;
}
export function closeDb() {
    if (db) {
        db.close();
        db = null;
    }
}
//# sourceMappingURL=connection.js.map