# Deployment artifacts

Systemd units and helper scripts for running gmag_webui (and the mag-usb MQTT
bridge) on a host. The units are **templates** (`*.service.in`) with placeholders
that `install.sh` fills in by auto-resolving the service user, their home, and the
repo path — so nothing here is pinned to a specific username or host.

> Credentials are **not** in this repo. The services read secrets from
> `EnvironmentFile`s created on the host (`<repo>/.env`,
> `<bridge-dir>/bridge.env`), both `chmod 600`. Create those by hand; never
> commit them.

## Files

| File | Purpose |
|------|---------|
| `install.sh` | Resolves user/home/repo, renders the `.in` templates, installs everything. |
| `gmag-webui.service.in` | The dashboard (native Deno server on `:8000`). |
| `ws-mqtt-bridge.service.in` | Runs `mag_mqtt.py` (needs `paho-mqtt` + `websockets`; `install.sh` installs them on apt systems). |
| `mag_mqtt.py` | mag-usb WebSocket → MQTT bridge (publishes to `magnetometer/data`). |
| `gmag-webui-update.service.in` | Oneshot that runs the update script (passes `GMAG_REPO`). |
| `gmag-webui-update.timer` | Fires the update check every 5 minutes. |
| `gmag-webui-update.sh` | Fetches origin; on a new commit for the tracked branch, `git reset --hard` + restart the dashboard. |

### Template placeholders

`install.sh` substitutes these in the `.in` files:

| Placeholder | Resolved to |
|-------------|-------------|
| `@USER@` | service user (see resolution order below) |
| `@HOME@` | that user's home directory |
| `@REPO@` | this checkout's location |
| `@BRIDGE_DIR@` | `<home>/ws-mqtt-bridge` (override with `--bridge-dir`) |

## Install

```bash
sudo deploy/install.sh                    # auto-resolve the service user
sudo deploy/install.sh --user wsprdaemon  # or force a specific user
sudo deploy/install.sh --enable           # also enable + start the units
```

User resolution order: `--user` → `$SUDO_USER` (the human who ran sudo) → the
owner of the repo checkout. The installer never starts services unless `--enable`
is given (so you can create the `.env`/`bridge.env` files first).

## Auto-update behavior

- The timer runs `gmag-webui-update.sh` every ~5 minutes. It compares the clone's
  `HEAD` against `origin/<current-branch>` and, if they differ, forces the clone
  to the remote (`git reset --hard`) and restarts `gmag-webui`.
- **Pushing to the tracked branch is a live deploy** — the host picks it up within
  a timer interval and restarts the dashboard (a brief blip).
- `git reset --hard` discards local edits in the clone (gitignored files like
  `.env` are kept). Switch the script to `git merge --ff-only` if you prefer
  updates to be skipped on divergence rather than overwritten.
- The update runs as root but performs git operations as the repo owner (resolved
  from the repo directory) via `runuser`.

Inspect: `systemctl status gmag-webui-update.timer`,
`journalctl -u gmag-webui-update.service`.
