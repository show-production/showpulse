# Contributing to ShowPulse

## Git Workflow

### Branching

- **No direct pushes to master** — all work goes through feature branches + PR.
- Branch from latest master:
  ```bash
  git fetch origin master
  git checkout -b feature/my-feature origin/master
  ```
- Keep branches short-lived — merge within 1–2 days.

### Before Pushing

Always rebase on latest master before pushing:
```bash
git fetch origin master
git rebase origin/master
```

### Force Pushing

- Use `--force-with-lease` instead of `--force` to protect teammates' work.
- Never force-push to master.

### Pull Requests

- Keep PR titles short (under 70 characters).
- Include a summary of changes and a test plan.
- Version bumps are the PR author's responsibility (see below).

### Merging

- PRs are merged into master after review.
- Delete the feature branch after merge.

## Version Bumps

Follow [SemVer](https://semver.org/):

| Change | Bump | Example |
|--------|------|---------|
| Bug fix, polish | PATCH | `0.1.0` → `0.1.1` |
| New feature, new endpoint | MINOR | `0.1.1` → `0.2.0` |
| Breaking API change | MAJOR | `0.2.0` → `1.0.0` |

Update the version in `Cargo.toml` as part of your PR.

## Backend / Frontend Coordination

- Backend engineer edits `src/`, `Cargo.toml`, `Cargo.lock` only.
- Frontend engineer edits `static/` only.
- Shared files (`CONTRIBUTING.md`, `README.md`, config) — coordinate before editing.
- **Axum route syntax**: We're on Axum **0.7.9** which uses `:id` for path params. The `{id}` syntax was introduced in 0.7.10+. Always verify against the locked version in `Cargo.lock`.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SHOWPULSE_PORT` | `8080` | Server port |
| `SHOWPULSE_BIND` | `0.0.0.0` | Bind address |
| `SHOWPULSE_DATA_FILE` | `showpulse-data.json` | Data file path |
| `SHOWPULSE_PIN` | *(none)* | PIN for auth (unset = open access) |
