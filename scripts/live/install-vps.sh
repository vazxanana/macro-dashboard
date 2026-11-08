#!/usr/bin/env bash
# MeridianX council live runner: one-shot install on a fresh Debian/Ubuntu VPS (run as a normal user with sudo).
#   curl -fsSL https://raw.githubusercontent.com/vazxanana/macro-dashboard/main/scripts/live/install-vps.sh | bash
# Installs Node 22 and git, clones the repository to ~/macro-dashboard, creates ~/meridianx/.env from the template (you fill
# the values), installs the user service and starts it. Secrets never leave ~/meridianx/.env.
set -euo pipefail
REPO=${LIVE_REPO:-vazxanana/macro-dashboard}
if ! command -v node >/dev/null || [ "$(node -v | cut -c2-3)" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -; sudo apt-get install -y nodejs
fi
command -v git >/dev/null || sudo apt-get install -y git
[ -d "$HOME/macro-dashboard/.git" ] || git clone -q "https://github.com/$REPO.git" "$HOME/macro-dashboard"
mkdir -p "$HOME/meridianx"
[ -f "$HOME/meridianx/.env" ] || { cp "$HOME/macro-dashboard/scripts/live/env.example" "$HOME/meridianx/.env"; chmod 600 "$HOME/meridianx/.env"; }
mkdir -p "$HOME/.config/systemd/user"
cp "$HOME/macro-dashboard/scripts/live/meridianx-live.service" "$HOME/.config/systemd/user/"
systemctl --user daemon-reload
sudo loginctl enable-linger "$USER" || true
systemctl --user enable --now meridianx-live
echo
echo "Installed. Now put your values in $HOME/meridianx/.env (nano $HOME/meridianx/.env), then: systemctl --user restart meridianx-live"
echo "Logs: journalctl --user -u meridianx-live -f"
