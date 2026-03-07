# ShowPulse Security Review

**Date:** 2026-03-07
**Scope:** Full codebase review — Rust/Axum backend, JavaScript frontend, configuration, dependencies

---

## Executive Summary

ShowPulse is a Rust/Axum web application for live show cue management with WebSocket real-time updates. The codebase demonstrates **solid security fundamentals** — input sanitization, role-based access control, CORS restrictions, and security headers are all present. However, several issues ranging from **critical to low** severity were identified.

---

## Findings

### CRITICAL — Plaintext PIN Storage

**Location:** `src/cue/store.rs:537-539`, `src/auth.rs:38`

PINs are stored and compared as plaintext strings in the JSON data file. The `find_user_by_credentials` method does a direct string comparison:

```rust
data.users.iter().find(|u| u.name == name && u.pin == pin).cloned()
```

**Risk:** If the data file (`showpulse-data.json`) is exposed (backup leak, misconfigured file server, directory traversal), all user PINs are immediately compromised. Plaintext credential storage is an OWASP Top 10 violation (A02: Cryptographic Failures).

**Recommendation:** Hash PINs using `argon2` or `bcrypt` before storage. Compare using constant-time comparison. The `pin` field in `User` should store the hash, not the raw value.

---

### HIGH — No Brute-Force Protection on Login

**Location:** `src/auth.rs:153-175`

The login endpoint has no rate limiting, account lockout, or delay mechanism. An attacker can attempt unlimited PIN combinations.

**Risk:** PINs are typically short numeric codes (4-6 digits). Without rate limiting, a brute-force attack could crack a 4-digit PIN in under 10,000 requests — trivially achievable in seconds.

**Recommendation:** Implement per-IP or per-username rate limiting on `/api/auth/login`. Consider exponential backoff after failed attempts (e.g., 3 failures = 5s delay, 5 failures = 30s lockout).

---

### HIGH — GET Requests Bypass Authentication Entirely

**Location:** `src/auth.rs:205-213`

The auth middleware unconditionally allows all GET requests without authentication:

```rust
if req.method() == Method::GET {
    // Still try to attach session if token is present
    if let Some(token) = extract_token(&req) { ... }
    return next.run(req).await;
}
```

**Risk:** All read endpoints are accessible without authentication when auth is enabled. This means unauthenticated users can read:
- All cues and show data (`GET /api/cues`)
- All departments (`GET /api/departments`)
- All acts (`GET /api/acts`)
- Timer lock status (`GET /api/timer-lock`)
- Timecode status (`GET /api/timecode`)
- QR code with server URL (`GET /api/qr`)

While this may be intentional for crew viewers, it also exposes `GET /api/users` (though the handler requires Admin role). The blanket GET bypass means the auth middleware provides no defense-in-depth for read operations — it relies entirely on individual handler-level checks.

**Recommendation:** Consider requiring at minimum a valid session for sensitive GET endpoints, or document this as an intentional design decision for crew access. At minimum, ensure all GET handlers that return sensitive data have explicit role checks.

---

### MEDIUM — Session Tokens Have No Expiry

**Location:** `src/auth.rs:72-124`

Session tokens (UUIDs) are stored indefinitely in the in-memory `SessionStore` with no TTL or expiration mechanism. Tokens persist until:
- Explicit logout
- User deletion
- Server restart

The client stores tokens in `localStorage` (`static/js/state.js:94`), which also has no expiry.

**Risk:** Stolen tokens remain valid indefinitely. If a device is compromised or a session token is leaked, there's no automatic expiration to limit the window of exposure.

**Recommendation:** Add a `created_at` timestamp to sessions and implement a TTL (e.g., 24 hours). Periodically sweep expired sessions.

---

### MEDIUM — CORS Origin Only Allows localhost

**Location:** `src/main.rs:108-112`

```rust
let cors = CorsLayer::new()
    .allow_origin(AllowOrigin::exact(
        HeaderValue::from_str(&format!("http://localhost:{}", config.port))
            .expect("valid origin"),
    ));
```

CORS is hardcoded to `http://localhost:{port}`. When deployed on a network (the app binds to `0.0.0.0` by default), clients accessing via IP address or hostname will be blocked by CORS for cross-origin API requests.

**Risk:** This breaks legitimate usage when clients access via LAN IP (e.g., `http://192.168.1.50:8080`). Since the static files are served from the same origin, same-origin requests still work, but any external integrations or non-localhost access via browser JS will fail.

**Note:** This may actually be a functional bug more than a security issue. The static files are served from the same host, so the browser treats API calls as same-origin. CORS only matters for cross-origin requests from external pages.

---

### MEDIUM — No HTTPS / TLS Support

**Location:** `src/main.rs:149-150`

The server only supports plain HTTP. Auth tokens, PINs, and session data are transmitted in cleartext.

**Risk:** On shared networks (common in live event venues), traffic can be intercepted. Session tokens in `Authorization` headers and login PINs are visible to network sniffers.

**Recommendation:** Add optional TLS support via `axum-server` with `rustls`, or document that a reverse proxy (nginx, Caddy) should be used for production deployments.

---

### MEDIUM — Data File Has No Integrity Protection

**Location:** `src/cue/store.rs:89-101`

The JSON data file is read/written with no file locking, atomic writes, or integrity verification.

**Risk:**
1. **Corruption on crash:** If the process crashes during `tokio::fs::write`, the file could be truncated/corrupted.
2. **Race condition:** Multiple instances could corrupt the file (unlikely for single-instance use, but no guard exists).

**Recommendation:** Use atomic write (write to temp file, then rename) to prevent corruption. The `tempfile` crate is already a dev-dependency.

---

### LOW — Client-Side Role Enforcement

**Location:** `static/js/auth.js:139-186`

Role-based UI gating (hiding tabs, transport controls) is enforced purely in JavaScript via `applyRole()`. The `authRole` value is stored in `localStorage` and could be tampered with.

**Risk:** A user could modify `localStorage` to set `authRole = 'admin'` and see hidden UI elements. However, backend handlers enforce roles correctly (`require_role` checks), so this would only reveal UI — actual operations would fail with 401/403.

**Impact:** Low — defense in depth is maintained by server-side checks. This is acceptable for a UI convenience layer.

---

### LOW — Token Passed in WebSocket Query Parameter

**Location:** `static/js/api.js:46`, `src/main.rs:41`

```javascript
const tokenParam = authToken ? `?token=${encodeURIComponent(authToken)}` : '';
ws = new WebSocket(`${proto}//${location.host}/ws${tokenParam}`);
```

**Risk:** Tokens in URL query parameters may be logged in server access logs, proxy logs, or browser history. This is a standard limitation of WebSocket authentication since WebSocket doesn't support custom headers during the handshake.

**Recommendation:** This is an accepted pattern for WebSocket auth. Ensure server access logs don't capture query parameters, or implement a short-lived ticket exchange mechanism.

---

### LOW — innerHTML Usage in Frontend

**Location:** Multiple files (manage.js, auth.js, show.js)

The codebase uses `innerHTML` extensively for rendering lists. However, user-controlled data is consistently escaped via the `esc()` helper (`state.js:278-282`):

```javascript
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
```

**Assessment:** The `esc()` function provides proper HTML entity encoding. All user-visible strings (names, labels, notes) are passed through `esc()` before insertion into `innerHTML`. The `d.color` values used in inline styles are sanitized server-side via `sanitize_color()`. **No XSS vulnerabilities were found.**

---

### LOW — Unvalidated department_id References in Cue Mutations

**Location:** `src/cue/store.rs:185-197`, `src/cue/store.rs:279-302`

When creating or updating a cue, the `department_id` is not validated against existing departments. Only bulk import (`import_cues`) validates department references.

**Risk:** Orphaned cues could reference non-existent departments, causing UI display issues (department shows as "?"). This is a data integrity issue, not a security vulnerability.

---

## Positive Security Observations

The following security measures are well-implemented:

1. **Input sanitization** — `clamp_string()` (500 char limit), `sanitize_color()`, `sanitize_timecode()` are consistently applied to all user input in the store layer.

2. **Directory traversal prevention** — `CueStore::new()` rejects paths containing `..` segments and canonicalizes the data file path.

3. **Request size limits** — 1MB body limit via `DefaultBodyLimit::max(1024 * 1024)`.

4. **Concurrency limits** — 50 concurrent requests via `ConcurrencyLimitLayer`, 100 max WebSocket clients.

5. **Security headers** — `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY` are set.

6. **Server-side role enforcement** — All mutation endpoints check roles via `require_role()`. User management is Admin-only. Timer operations require Manager+ with lock.

7. **PIN scrubbing on list** — `api/users.rs:18-19` clears PINs before returning user list.

8. **Self-deletion prevention** — Admin cannot delete their own account (`api/users.rs:55-57`).

9. **Session cleanup on user deletion** — Deleting a user revokes all their sessions (`api/users.rs:60`).

10. **Timer lock auto-release** — WebSocket disconnect automatically releases timer lock (`ws/hub.rs:137-146`).

11. **XSS prevention** — Consistent use of `esc()` helper for HTML escaping in frontend rendering.

12. **UUID-based IDs** — Server generates all IDs server-side, ignoring client-provided IDs for create operations.

---

## Priority Recommendations

| Priority | Finding | Effort |
|----------|---------|--------|
| **P0** | Hash PINs (argon2/bcrypt) | Medium |
| **P1** | Add login rate limiting | Low-Medium |
| **P1** | Add session expiry/TTL | Low |
| **P2** | Atomic file writes | Low |
| **P2** | Document HTTPS/reverse proxy requirement | Low |
| **P3** | Validate department_id on cue create/update | Low |
