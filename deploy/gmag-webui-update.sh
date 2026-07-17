#!/usr/bin/env bash
#
# Auto-update the gmag_webui deploy clone from origin and restart the dashboard
# when the tracked branch has advanced (or diverged). Safe no-op when in sync.
#
# Runs as root (to restart the service) but performs every git operation as the
# repo owner via runuser, so file ownership stays correct and git does not
# refuse with "detected dubious ownership". The owner is resolved from the repo
# directory itself, so nothing here is pinned to a specific username.
#
# NOTE: this uses `git reset --hard`, so the clone is forced to match the remote
# tracked branch on every run -- local edits in the clone are discarded (gitignored
# files such as .env are preserved). Pushing to the tracked branch therefore acts
# as a live deploy. Change `reset --hard` to `merge --ff-only` below if you prefer
# updates to be skipped (rather than overwritten) when the clone diverges.
#
# Installed to /usr/local/bin/gmag-webui-update.sh, driven by
# gmag-webui-update.timer. GMAG_REPO is provided by gmag-webui-update.service.
set -euo pipefail

REPO="${GMAG_REPO:?GMAG_REPO must be set to the gmag_webui clone path}"
SERVICE="${GMAG_SERVICE:-gmag-webui.service}"
OWNER="${GMAG_OWNER:-$(stat -c %U "$REPO")}"
OWNER_HOME="$(getent passwd "$OWNER" | cut -d: -f6)"

git_as_owner() {
    runuser -u "$OWNER" -- env HOME="$OWNER_HOME" git -C "$REPO" "$@"
}

branch="$(git_as_owner rev-parse --abbrev-ref HEAD)"
git_as_owner fetch --quiet origin "$branch"

local_rev="$(git_as_owner rev-parse HEAD)"
remote_rev="$(git_as_owner rev-parse "origin/${branch}")"

if [ "$local_rev" = "$remote_rev" ]; then
    echo "gmag_webui up to date on ${branch} (${local_rev:0:7})"
    exit 0
fi

echo "gmag_webui ${branch}: ${local_rev:0:7} -> ${remote_rev:0:7}; updating"
git_as_owner reset --hard "origin/${branch}"
systemctl restart "$SERVICE"
echo "gmag_webui updated to ${remote_rev:0:7}; restarted ${SERVICE}"
