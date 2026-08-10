#!/bin/bash
# sns-myagent deploy script
# Copies systemd units + cron jobs. Does NOT auto-enable. Run interactively.
#
# Usage: bash deploy/install.sh [--enable]
#   --enable  also enable+start systemd services and install crons

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ENABLE=false
[[ "${1:-}" == "--enable" ]] && ENABLE=true

# --- Systemd units ---
echo "[1/3] Installing systemd units..."
install -d /etc/systemd/system
install -m 0644 "$SCRIPT_DIR/systemd/snsagent.service" /etc/systemd/system/
install -m 0644 "$SCRIPT_DIR/systemd/snsagent-restart.service" /etc/systemd/system/
install -m 0644 "$SCRIPT_DIR/systemd/snsagent-restart.timer" /etc/systemd/system/

# --- Secrets dir (if not exists) ---
if [[ ! -d /etc/snsagent ]]; then
  echo "[2/3] Creating /etc/snsagent/ for secrets (chmod 600)..."
  install -d -m 0700 /etc/snsagent
  if [[ ! -f /etc/snsagent/secrets.env ]]; then
    cat > /etc/snsagent/secrets.env <<'EOF'
# sns-myagent secrets — populate then chmod 600
# SNS_TELEGRAM_BOT_TOKEN=
# SNS_TELEGRAM_CHAT_ID=
EOF
    chmod 0600 /etc/snsagent/secrets.env
    echo "  -> /etc/snsagent/secrets.env created. Fill in tokens before starting."
  fi
else
  echo "[2/3] /etc/snsagent/ exists, skipping."
fi

# --- Cron jobs ---
echo "[3/3] Installing cron jobs..."
install -d /etc/cron.d
install -m 0644 "$SCRIPT_DIR/cron/snsagent-watchdog" /etc/cron.d/
install -m 0644 "$SCRIPT_DIR/cron/nine-router-watchdog" /etc/cron.d/
install -m 0644 "$SCRIPT_DIR/cron/snsagent-backup" /etc/cron.d/
install -m 0644 "$SCRIPT_DIR/cron/snsagent-logs" /etc/cron.d/

systemctl daemon-reload

if [[ "$ENABLE" == "true" ]]; then
  echo ""
  echo "Enabling services + crons..."
  systemctl enable snsagent.service
  systemctl enable snsagent-restart.timer
  systemctl start snsagent.service
  echo ""
  echo "Done. Check: systemctl status snsagent"
else
  echo ""
  echo "Installed but NOT enabled. To activate:"
  echo "  systemctl enable --now snsagent"
  echo "  systemctl enable --now snsagent-restart.timer"
  echo "  bash $0 --enable   (does the above automatically)"
fi
