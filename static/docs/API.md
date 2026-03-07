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
GET /cues?department_id=<uuid>
Response: [{id, department_id, cue_number, label, trigger_tc, warn_seconds, notes, duration, armed, color, continue_mode, post_wait, act_id}, ...]
```

`trigger_tc` format: `{hours, minutes, seconds, frames}`

### Get single cue
```
GET /cues/:id
Response: {id, department_id, cue_number, label, trigger_tc, warn_seconds, notes, duration, armed, color, continue_mode, post_wait, act_id}
```

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
  post_wait?,           // f64 (seconds), only used with auto_continue
  act_id?               // UUID, null = unassigned
}
Response: {id, department_id, cue_number, label, trigger_tc, warn_seconds, notes, duration, armed, color, continue_mode, post_wait, act_id}
```

Only `department_id` is mandatory (serde defaults apply for others).

### Update cue
```
PUT /cues/:id
Body: {id, department_id, cue_number, label, trigger_tc, warn_seconds, notes, duration?, armed?, color?, continue_mode?, post_wait?, act_id?}
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

Replaces all existing cues.

## Show

### Import full show (replace)
```
POST /show/import
Body: {departments: [...], cues: [...], acts?: [...], show_name?: "..."}
Response: {imported: number, errors: [{index, message}, ...]}
```

Replaces all existing departments, cues, and acts.

### Get show name
```
GET /show/name
Response: {name: "My Show"}
```

### Set show name (Manager+)
```
PUT /show/name
Body: {name: "My Show"}
Response: 204 No Content
```

## Acts

### List acts
```
GET /acts
Response: [{id, name, sort_order}, ...]
```

Sorted by `sort_order`.

### Create act (Operator+)
```
POST /acts
Body: {id?: "00000000-...", name: "Act 1", sort_order?: 1}
Response: {id, name, sort_order}
```

### Update act (Operator+)
```
PUT /acts/:id
Body: {id, name, sort_order}
Response: {id, name, sort_order}
```

### Delete act (Operator+)
```
DELETE /acts/:id
Response: 204 No Content
```

Cues in the deleted act are unassigned (not deleted).

### Shift act cues (Operator+)
```
POST /acts/:id/shift
Body: {start_tc: {hours, minutes, seconds, frames}}
Response: 204 No Content
```

Moves all cues in the act so the first cue starts at the given timecode. Other cues shift by the same offset.

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

Requires Manager+ role AND timer lock (or Admin).

### Goto timecode
```
POST /generator/goto
Body: {timecode: {hours, minutes, seconds, frames}}
Response: 204 No Content
```

### Get generator status
```
GET /generator
Response: {mode, frame_rate, state, start_tc, current_tc, loop_in, loop_out, speed}
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

## Admin Dashboard

### Get active users dashboard (Admin only)
```
GET /admin/dashboard
Response: {
  total_connections: number,
  authenticated_connections: number,
  clients: [
    {user_name: "John" | null, role: "manager" | null, connected_seconds: 1234, is_authenticated: bool},
    ...
  ],
  timer_lock: {locked: bool, holder?: {user_id: "uuid", user_name: "John"}}
}
```

Returns a snapshot of all connected WebSocket clients, their roles, connection durations, and current timer lock status.

## Authentication

When users exist in the system, mutation endpoints (POST/PUT/DELETE) require a valid session token. GET endpoints and WebSocket remain open. When no users are configured, all endpoints are open.

### Check auth status
```
GET /auth/status
Response: {auth_enabled: bool}
```

### Login
```
POST /auth/login
Body: {name: "admin", pin: "1234"}
Response: {token: "...", role: "admin", name: "admin", departments: ["uuid", ...]}   // 200 OK
Response: 401 Unauthorized  // wrong name or PIN
```

### Logout
```
POST /auth/logout
Header: Authorization: Bearer <token>
Response: 204 No Content
```

Token is passed via `Authorization: Bearer <token>` header on subsequent requests. For WebSocket, pass as `?token=<token>` query parameter.

## Users (Admin only)

### List users
```
GET /users
Response: [{id, name, role, departments}, ...]
```

PINs are stripped from the response.

### Create user
```
POST /users
Body: {name: "...", pin: "...", role: "operator", departments?: ["uuid", ...]}
Response: {id, name, role, departments}
```

Role values: `"viewer"`, `"crew_lead"`, `"operator"`, `"manager"`, `"admin"`

### Update user
```
PUT /users/:id
Body: {id, name, pin?, role, departments?}
Response: {id, name, role, departments}
```

### Delete user
```
DELETE /users/:id
Response: 204 No Content
```

Self-delete is blocked (400 Bad Request).

## Timer Lock

Exclusive timer control. Only one Manager can hold the lock at a time. Admins bypass the lock entirely.

### Get lock status
```
GET /timer-lock
Response: {locked: bool, holder_name?: "...", holder_id?: "uuid"}
```

### Acquire lock (Manager+)
```
POST /timer-lock
Response: 200 OK          // lock acquired
Response: 409 Conflict     // already held by another user
```

### Release lock
```
DELETE /timer-lock
Response: 204 No Content
```

Own lock or Admin override.

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
WS /ws?token=<auth_token>
```

### Message format (server -> client, ~10Hz)
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
      "elapsed_sec": null,
      "act_id": "uuid-or-null",
      "act_name": "Act 1"
    }
  ]
}
```

### Cue state values
| State | Meaning |
|-------|---------|
| `upcoming` | Not yet in warning range |
| `warning` | Within warn_seconds of trigger |
| `go` | Triggered -- held for 2 seconds for GO! animation |
| `active` | Past trigger TC + GO hold delay, still running |
| `passed` | Next same-department cue has triggered, or duration expired |
