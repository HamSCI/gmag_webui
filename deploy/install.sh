#!/usr/bin/env bash
#
# Install/refresh the gmag_webui systemd units, auto-resolving the service user,
# their home directory, and the repo location. Nothing is pinned to a specific
# username -- run it on any host and it adapts.
#
# Usage (run with sudo, from anywhere):
#   sudo deploy/install.sh                     # resolve user automatically
#   sudo deploy/install.sh --user wsprdaemon   # force a specific service user
#   sudo deploy/install.sh --enable            # also enable+start the units
#
# User resolution order: --user  >  $SUDO_USER (the human who ran sudo)  >
# the owner of the repo checkout.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(realpath "$0")")" && pwd)"   # .../deploy
REPO="$(dirname "$SCRIPT_DIR")"                              # repo root

USER_ARG="" ; DO_ENABLE=0
while [ $# -gt 0 ]; do
    case "$1" in
        --user)    USER_ARG="${2:?}"; shift 2 ;;
        --enable)  DO_ENABLE=1; shift ;;
        -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) echo "unknown argument: $1" >&2; exit 2 ;;
    esac
done

if [ "$(id -u)" -ne 0 ]; then
    echo "error: run with sudo (needs to write /etc/systemd/system)" >&2
    exit 1
fi

# --- resolve the service user ---
if [ -n "$USER_ARG" ]; then
    SVC_USER="$USER_ARG"
elif [ -n "${SUDO_USER:-}" ] && [ "${SUDO_USER}" != "root" ]; then
    SVC_USER="$SUDO_USER"
else
    SVC_USER="$(stat -c %U "$REPO")"
fi

if ! getent passwd "$SVC_USER" >/dev/null; then
    echo "error: user '$SVC_USER' does not exist" >&2
    exit 1
fi
SVC_HOME="$(getent passwd "$SVC_USER" | cut -d: -f6)"

cat <<EOF
Installing gmag_webui units with:
  service user : $SVC_USER
  home         : $SVC_HOME
  repo         : $REPO
EOF

render() {   # substitute placeholders in a .in template -> stdout
    sed -e "s|@USER@|$SVC_USER|g" \
        -e "s|@HOME@|$SVC_HOME|g" \
        -e "s|@REPO@|$REPO|g" \
        "$1"
}

# --- render + install unit files ---
for unit in gmag-webui.service gmag-webui-update.service; do
    render "$SCRIPT_DIR/$unit.in" > "/etc/systemd/system/$unit"
    chmod 0644 "/etc/systemd/system/$unit"
    echo "installed /etc/systemd/system/$unit"
done
install -m 0644 "$SCRIPT_DIR/gmag-webui-update.timer" /etc/systemd/system/gmag-webui-update.timer
install -m 0755 "$SCRIPT_DIR/gmag-webui-update.sh"    /usr/local/bin/gmag-webui-update.sh
echo "installed /usr/local/bin/gmag-webui-update.sh"

systemctl daemon-reload
echo "daemon-reloaded."

if [ "$DO_ENABLE" -eq 1 ]; then
    systemctl enable --now gmag-webui.service gmag-webui-update.timer
    echo "enabled + started gmag-webui and gmag-webui-update.timer"
else
    cat <<EOF

Next steps:
  1. Create the env file (chmod 600) if it doesn't exist:
       $REPO/.env   -> HOST, PORT
  2. Enable + start:
       sudo systemctl enable --now gmag-webui.service gmag-webui-update.timer
EOF
fi
