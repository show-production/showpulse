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
PUT /departments/:id
Body: {id, name, color}
Response: {id, name, color}
```

### Delete department
```
DELETE /departments/:id
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
Body: {
  department_id,        // required (UUID)
  id?,                  // UUID, auto-generated if omitted
  cue_number?,          // String, auto-generated (Q1, Q2...) if empty
  label?,               // String, default: "Untitled Cue"
  trigger_tc?,          // {hours, minutes, seconds, frames}, default: 00:00:00:00
  warn_seconds?,        // u32, default: 10
  notes?,               // String, default: ""
  duration?,            // u32 (seconds), null = point cue
  armed?,               // bool, default: true
  color?,               // String (hex, e.g. "#ff0000"), null = use dept color
  continue_mode?,       // "stop" | "auto_continue" | "auto_follow", default: "stop"
  post_wait?            // f64 (seconds), only used with auto_continue
}
Response: {id, department_id, cue_number, label, trigger_tc, warn_seconds, notes, duration, armed, color, continue_mode, post_wait}
```

Only `department_id` is mandatory (serde defaults apply for others).

### Update cue
```
PUT /cues/:id
Body: {id, department_id, cue_number, label, trigger_tc, warn_seconds, notes, duration?, armed?, color?, continue_mode?, post_wait?}
Response: {id, ...}
```

### Delete cue
```
DELETE /cues/:id
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

## Authentication

When `SHOWPULSE_PIN` is set, mutation endpoints (POST/PUT/DELETE) require a valid session token. GET endpoints and WebSocket remain open.

### Check auth status
```
GET /auth/status
Response: {enabled: bool, authenticated: bool}
```

### Login
```
POST /auth/login
Body: {pin: "1234"}
Response: {token: "..."}   // 200 OK
Response: 401 Unauthorized  // wrong PIN
```

### Logout
```
POST /auth/logout
Header: Authorization: Bearer <token>
Response: 204 No Content
```

Token is passed via `Authorization: Bearer <token>` header on subsequent requests. For WebSocket, pass as `?token=<token>` query parameter.

## QR Code

### Generate QR code
```
GET /qr
Response: SVG image (image/svg+xml) with server URL for crew onboarding
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
  "frame_rate": 30,
  "cues": [
    {
      "id": "uuid",
      "department_id": "uuid",
      "department": "Lighting",
      "cue_number": "Q1",
      "label": "House lights down",
      "trigger_tc": {"hours": 0, "minutes": 1, "seconds": 0, "frames": 0},
      "state": "warning",
      "countdown_sec": 5.2,
      "armed": true,
      "duration": null,
      "color": null,
      "elapsed_sec": null
    }
  ]
}
```

### Cue state values
| State | Meaning |
|-------|---------|
| `upcoming` | Not yet in warning range |
| `warning` | Within warn_seconds of trigger |
| `go` | Triggered — held for 2 seconds for GO! animation |
| `active` | Past trigger TC + GO hold delay, still running |
| `passed` | Next same-department cue has triggered, or duration expired |
