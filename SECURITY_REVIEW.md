# ShowPulse Security Review

**Date:** 2026-03-07 (updated after commits 4993c03, ccf9d4f)
**Scope:** Full codebase review — Rust/Axum backend, JavaScript frontend, configuration, dependencies

---

## Executive Summary

ShowPulse is a Rust/Axum web application for live show cue management with WebSocket real-time updates. After the security hardening in commit `4993c03`, the three most critical findings from the initial review have been **resolved**: PINs are now hashed with argon2, login rate limiting is in place, session tokens expire after 8 hours, and file writes are atomic. The remaining findings are **medium to low severity**.

---

## Resolved Findings (commit 4993c03)

### ~~CRITICAL — Plaintext PIN Storage~~ → RESOLVED

**Fix:** PINs are now hashed using argon2 (`src/auth.rs:29-48`). The `hash_pin()` function generates a random salt via `OsRng`, and `verify_pin()` uses argon2's constant-time verification. Existing plaintext PINs are auto-migrated at startup via `migrate_plaintext_pins()` (`src/cue/store.rs:626-641`). The `is_hashed()` check (`$argon2` prefix) prevents double-hashing.

**Assessment:** Well implemented. The migration path is clean and handles the transition gracefully.

### ~~HIGH — No Brute-Force Protection~~ → RESOLVED

**Fix:** `LoginLimiter` (`src/auth.rs:103-155`) tracks failed attempts per IP. After 5 failures within 60 seconds, the IP is locked out with `429 Too Many Requests`. Successful login clears the counter. A background task prunes stale entries every 10 minutes.

**Assessment:** Solid implementation. One minor note: the limiter is IP-based, so all users behind a shared NAT/proxy share the same limit. This is acceptable for the typical deployment scenario (venue LAN).

### ~~MEDIUM — No Session Expiry~~ → RESOLVED

**Fix:** Sessions now carry a `created_at: Instant` timestamp and expire after 8 hours (`SESSION_TTL_SECS`). `get_session()` checks expiry on access and removes expired tokens. A background purge task runs every 10 minutes (`src/main.rs:103-113`).

**Assessment:** Clean implementation. The 8-hour TTL is reasonable for a show day.

### ~~MEDIUM — X-Forwarded-For IP Spoofing~~ → RESOLVED (ccf9d4f)

**Fix:** `extract_client_ip()` now uses only `ConnectInfo<SocketAddr>` — the actual TCP peer address (`src/auth.rs:436-441`). The `X-Forwarded-For` and `X-Real-IP` header trust has been completely removed, eliminating the spoofing vector.

**Assessment:** Clean fix. The rate limiter is now unspoofable for direct connections. Note: if deployed behind a reverse proxy, all requests will appear from the proxy's IP (typically `127.0.0.1`), meaning rate limiting would apply to all clients collectively. This is acceptable since a reverse proxy would handle its own rate limiting.

### ~~MEDIUM — Non-Atomic File Writes~~ → RESOLVED

**Fix:** `persist()` now writes to a `.json.tmp` file and renames atomically (`src/cue/store.rs:89-107`). This prevents corruption if the process crashes mid-write.

**Assessment:** Correct approach. `rename()` is atomic on most filesystems.

---

## Remaining Findings

### MEDIUM — GET Requests Bypass Authentication

**Location:** `src/auth.rs:352-361`

The auth middleware still allows all GET requests without a valid session:

```rust
if req.method() == Method::GET {
    // Still try to attach session if token is present (for role-gated GETs)
    if let Some(token) = extract_token(&req) { ... }
    return next.run(req).await;
}
```

**Risk:** All read endpoints are accessible without authentication. This includes cue data, departments, acts, timecode status, and the QR code. While `GET /api/users` has a handler-level Admin role check, the middleware provides no defense-in-depth for read operations.

**Mitigation:** This appears intentional for crew viewer access — crew members can view the show flow without logging in. However, it should be explicitly documented as a design decision. Consider whether `GET /api/users` should have middleware-level protection as an additional safeguard.

**Severity:** Medium (intentional design, but worth documenting)

---

### MEDIUM — CORS Origin Only Allows localhost

**Location:** `src/main.rs:125-129`

CORS is hardcoded to `http://localhost:{port}`. Since the app serves its own static files, this doesn't affect normal operation (requests are same-origin). However, it blocks legitimate cross-origin integrations from other tools accessing the API.

**Impact:** Low for typical use — only affects external integrations, not the built-in UI.

---

### MEDIUM — No HTTPS / TLS Support

**Location:** `src/main.rs:166-172`

The server only supports plain HTTP. Auth tokens, PINs, and WebSocket traffic are transmitted in cleartext.

**Risk:** On shared networks (common in live event venues), traffic can be sniffed. Session tokens in `Authorization` headers and login PINs are visible.

**Recommendation:** Document that a reverse proxy (nginx, Caddy) should be used for production deployments requiring TLS. Alternatively, add optional `rustls` support.

---

### LOW — Client-Side Role Enforcement

**Location:** `static/js/auth.js`

Role-based UI gating is enforced in JavaScript via `applyRole()`. The `authRole` value in `localStorage` could be tampered with to reveal hidden UI elements.

**Impact:** Low — server-side `require_role()` checks prevent unauthorized actions. This is a UI convenience layer only.

---

### LOW — Token in WebSocket Query Parameter

**Location:** `static/js/api.js:46-47`

Auth tokens are passed as `?token=` query parameters for WebSocket connections. Tokens may appear in server logs or browser history.

**Impact:** Low — this is a standard WebSocket authentication pattern. The 8-hour session TTL now limits exposure of logged tokens.

---

### LOW — No PIN Complexity Requirements

**Location:** `src/cue/store.rs:554-567`

PINs are accepted without any minimum length or complexity validation. A single-character PIN is valid.

**Risk:** Even with rate limiting (5 attempts/60s), a weak PIN (e.g., "1234", "0000") is guessable. Argon2 hashing protects against offline attacks but doesn't help with online guessing.

**Recommendation:** Enforce a minimum PIN length (e.g., 4 digits) in `create_user()` and `update_user()`.

---

### LOW — Unvalidated department_id on Single Cue Create/Update

**Location:** `src/cue/store.rs:191-203`, `src/cue/store.rs:285-308`

Creating or updating a single cue does not validate that `department_id` references an existing department. Only bulk import validates this.

**Impact:** Data integrity issue only — orphaned cues show department as "?" in the UI but cause no security impact.

---

## Positive Security Observations

The following security measures are well-implemented:

1. **Argon2 PIN hashing** — Random salt per PIN, constant-time verification, automatic migration of legacy plaintext PINs
2. **Login rate limiting** — Per-IP tracking with automatic lockout and periodic cleanup
3. **Session TTL** — 8-hour expiry with background purge task
4. **Atomic file writes** — Write-to-temp + rename prevents corruption
5. **Input sanitization** — `clamp_string()` (500 char limit), `sanitize_color()`, `sanitize_timecode()` consistently applied
6. **Directory traversal prevention** — `CueStore::new()` rejects `..` segments and canonicalizes paths
7. **Request size limits** — 1MB body limit via `DefaultBodyLimit`
8. **Concurrency limits** — 50 concurrent HTTP requests, 100 max WebSocket clients
9. **Security headers** — `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`
10. **Server-side role enforcement** — All mutation endpoints check roles via `require_role()`
11. **PIN scrubbing** — PINs (hashes) cleared before returning user list to clients
12. **Self-deletion prevention** — Admin cannot delete their own account
13. **Session cleanup on user deletion** — All sessions revoked when a user is deleted
14. **Timer lock auto-release** — WebSocket disconnect releases timer lock
15. **XSS prevention** — Consistent `esc()` helper for HTML escaping in all frontend rendering
16. **Server-generated UUIDs** — Client-provided IDs ignored on create operations

---

## Updated Priority Recommendations

| Priority | Finding | Status | Effort |
|----------|---------|--------|--------|
| ~~P0~~ | ~~Hash PINs (argon2)~~ | **RESOLVED** | — |
| ~~P1~~ | ~~Login rate limiting~~ | **RESOLVED** | — |
| ~~P1~~ | ~~Session expiry/TTL~~ | **RESOLVED** | — |
| ~~P2~~ | ~~Atomic file writes~~ | **RESOLVED** | — |
| ~~P2~~ | ~~Fix X-Forwarded-For trust~~ | **RESOLVED** | — |
| **P2** | Document HTTPS/reverse proxy requirement | Open | Low |
| **P2** | Document GET-without-auth as intentional design | Open | Low |
| **P3** | Add minimum PIN length validation | Open | Low |
| **P3** | Validate department_id on cue create/update | Open | Low |
