# ShowPulse API Reference

Base URL: `/api`

## Departments

### List departments
```
GET /departments
Response: [{id, name, color}, ...]
```

### Create department
```
POST /departments
Body: {id: "00000000-...", name: "Lighting", color: "#ffcc00"}
Response: {id, name, color}
```

### Update department
```
PUT /departments/{id}
Body: {id, name, color}
Response: {id, name, color}
```

### Delete department
```
DELETE /departments/{id}
Response: 204 No Content
```

## Cues

### List cues
```
GET /cues
Response: [{id, department_id, cue_number, label, trigger_tc, warn_seconds, notes}, ...]
```

`trigger_tc` format: `{hours, minutes, seconds, frames}`

### Create cue
```
POST /cues
Body: {id: "00000000-...", department_id, cue_number?, label, trigger_tc, warn_seconds?, notes?}
Response: {id, department_id, cue_number, label, trigger_tc, warn_seconds, notes}
```

Only `department_id` is mandatory (serde defaults apply for others).

### Update cue
```
PUT /cues/{id}
Body: {id, department_id, cue_number, label, trigger_tc, warn_seconds, notes}
Response: {id, ...}
```

### Delete cue
```
DELETE /cues/{id}
Response: 204 No Content
```

### Import cues (bulk)
```
POST /cues/import
Body: [{department_id, label?, trigger_tc?, warn_seconds?, notes?}, ...]
Response: {imported: number, errors: [{index, message}, ...]}
```

## Show Import

### Import full show (replace)
```
POST /show/import
Body: {departments: [...], cues: [...]}
Response: {imported: number, errors: [{index, message}, ...]}
```

Replaces all existing departments and cues.

## Timecode

### Get current timecode
```
GET /timecode
Response: {timecode: {hours, minutes, seconds, frames}, running: bool, frame_rate: string}
```

### Set source
```
PUT /timecode/source
Body: {source: "generator" | "ltc" | "mtc"}
Response: 204 No Content
```

## Generator

### Transport commands
```
POST /generator/play
POST /generator/pause
POST /generator/stop
Response: 204 No Content
```

### Goto timecode
```
POST /generator/goto
Body: {timecode: {hours, minutes, seconds, frames}}
Response: 204 No Content
```

### Update config
```
PUT /generator
Body: {mode, frame_rate, start_tc, loop_in?, loop_out?, speed}
Response: 204 No Content
```

Mode: `"freerun"` | `"countdown"` | `"clock"` | `"loop"`

## LTC

### List audio devices
```
GET /ltc/devices
Response: [{index: number, name: string}, ...]
```

### Select device
```
PUT /ltc/device
Body: {device_index: number}
Response: 204 No Content
```

### Stop LTC
```
POST /ltc/stop
Response: 204 No Content
```

## MTC

### List MIDI ports
```
GET /mtc/devices
Response: [{index: number, name: string}, ...]
```

### Select port
```
PUT /mtc/device
Body: {port_index: number}
Response: 204 No Content
```

### Stop MTC
```
POST /mtc/stop
Response: 204 No Content
```

## WebSocket

### Connect
```
WS /ws
```

### Message format (server → client, ~10Hz)
```json
{
  "timecode": "01:23:45:12",
  "status": "running",
  "frame_rate": "30",
  "cues": [
    {
      "id": "uuid",
      "department_id": "uuid",
      "department": "Lighting",
      "cue_number": "Q1",
      "label": "House lights down",
      "trigger_tc": {"hours": 0, "minutes": 1, "seconds": 0, "frames": 0},
      "warn_seconds": 10,
      "notes": "",
      "state": "warning",
      "countdown_sec": 5.2
    }
  ]
}
```

### Cue state values
| State | Meaning |
|-------|---------|
| `pending` | Not yet in warning range |
| `warning` | Within warn_seconds of trigger |
| `active` | Triggered (past trigger TC) |
| `passed` | Next same-department cue has triggered |
