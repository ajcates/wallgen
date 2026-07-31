#!/data/data/com.termux/files/usr/bin/bash

set -euo pipefail

PROJECT_DIR="/data/data/com.termux/files/home/dev/wallgen"
PYTHON_BIN="/data/data/com.termux/files/usr/bin/python"

cd "$PROJECT_DIR"
exec "$PYTHON_BIN" "$PROJECT_DIR/termux_gui/wallpaper_gui.py"
