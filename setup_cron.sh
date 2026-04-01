#!/data/data/com.termux/files/usr/bin/bash

show_help() {
    echo "Wallpaper Cron Setup Script"
    echo "Usage: ./setup_cron.sh [options]"
    echo ""
    echo "Interactive script to set up a cron job for regular wallpaper updates."
    echo "It installs required packages and sets up the crontab for you."
    echo ""
    echo "Options:"
    echo "  --help    Show this help message"
}

if [[ "$1" == "--help" ]]; then
    show_help
    exit 0
fi

# 1. Install necessary packages
echo "-----------------------------------------------"
echo "        Wallpaper Bot Setup - GWF"
echo "-----------------------------------------------"
pkg install -y cronie termux-api

PROJECT_DIR=$(pwd)
CONFIG_FILE="$PROJECT_DIR/config.env"

# 2. Interactive Input
echo ""
echo "Select your wallpaper style:"
echo "1) curves (Infinite Ribbon - Data Driven)"
echo "2) grid (Geometric Polygons)"
echo "3) glitch (Cyber Glitch)"
echo "4) smoke (Crystal Shards & Volumetric Smoke)"
echo "5) nebula (Cosmic Clusters)"
echo "6) fractal (Recursive Mandalas)"
echo "7) expressive (Material 3 Expressive - Fresh every time)"
read -p "Choose a style [1-7]: " style_choice

case $style_choice in
    1) STYLE="curves" ;;
    2) STYLE="grid" ;;
    3) STYLE="glitch" ;;
    4) STYLE="smoke" ;;
    5) STYLE="nebula" ;;
    6) STYLE="fractal" ;;
    7) STYLE="expressive" ;;
    *) STYLE="curves" ;;
esac

echo ""
read -p "Enter device width [default: 1080]: " WIDTH
WIDTH=${WIDTH:-1080}

read -p "Enter device height [default: 2400]: " HEIGHT
HEIGHT=${HEIGHT:-2400}

echo ""
read -p "Update frequency in minutes [default: 20]: " FREQ
FREQ=${FREQ:-20}

# 3. Save to config.env
echo "Saving preferences..."
cat > "$CONFIG_FILE" <<EOF
STYLE="$STYLE"
WIDTH=$WIDTH
HEIGHT=$HEIGHT
OUTPUT_DIR="$PROJECT_DIR/my_wallpapers"
EOF

# 4. Finalize script and cron
chmod +x update_wallpaper.sh
SCRIPT_PATH=$(realpath update_wallpaper.sh)

# Add to crontab
(crontab -l 2>/dev/null | grep -v "$SCRIPT_PATH"; echo "*/$FREQ * * * * $SCRIPT_PATH") | crontab -

# Ensure crond is running
pgrep crond > /dev/null || crond

echo "-----------------------------------------------"
echo "Setup Complete!"
echo "Style: $STYLE"
echo "Resolution: ${WIDTH}x${HEIGHT}"
echo "Updating every $FREQ minutes."
echo "Log file: $PROJECT_DIR/wallpaper_bot.log"
echo "-----------------------------------------------"
