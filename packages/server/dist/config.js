import { DEFAULT_FPS, DEFAULT_PORT } from '@showpulse/shared';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../..');
export const config = {
    port: parseInt(process.env.PORT || String(DEFAULT_PORT), 10),
    fps: parseInt(process.env.SHOWPULSE_FPS || String(DEFAULT_FPS), 10),
    dbPath: process.env.SHOWPULSE_DB_PATH || path.join(projectRoot, 'data', 'showpulse.db'),
    adminPin: process.env.SHOWPULSE_ADMIN_PIN || '',
    demoMode: process.env.SHOWPULSE_DEMO === 'true',
    sessionSecret: process.env.SESSION_SECRET || 'showpulse-dev-secret',
    pythonPath: process.env.SHOWPULSE_PYTHON_PATH || '',
    mdnsName: process.env.SHOWPULSE_MDNS_NAME || 'ShowPulse',
    midiPort: parseInt(process.env.SHOWPULSE_MIDI_PORT || '-1', 10),
};
//# sourceMappingURL=config.js.map