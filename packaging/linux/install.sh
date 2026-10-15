#!/bin/sh
# Adds RishFlow to your application menu. Run from the extracted RishFlow folder:
#   ./install.sh
set -e
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
DESKTOP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
mkdir -p "$DESKTOP_DIR"
cat > "$DESKTOP_DIR/rishflow.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=RishFlow
Comment=AI file organizer
Exec="$APP_DIR/RishFlow"
Icon=$APP_DIR/rishflow.png
Categories=Utility;FileTools;
Terminal=false
EOF
echo "RishFlow added to your applications menu."
