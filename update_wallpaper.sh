#!/data/data/com.termux/files/usr/bin/bash

# Configuration
PROJECT_DIR="/data/data/com.termux/files/home/dev/wallgen"
CONFIG_FILE="$PROJECT_DIR/config.env"

show_help() {
    echo "Wallpaper Updater Script"
    echo "Usage: ./update_wallpaper.sh [options]"
    echo ""
    echo "Options:"
    echo "  --style <name>   Override the default style (curves, grid, glitch, smoke, nebula, fractal)"
    echo "  --width <px>     Override the canvas width"
    echo "  --height <px>    Override the canvas height"
    echo "  --help           Show this help message"
    echo ""
    echo "The script uses defaults from config.env if no options are provided."
}

# Handle CLI arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --help) show_help; exit 0 ;;
        --style) STYLE="$2"; shift ;;
        --width) WIDTH="$2"; shift ;;
        --height) HEIGHT="$2"; shift ;;
        *) echo "Unknown parameter passed: $1"; show_help; exit 1 ;;
    esac
    shift
done

# Load configuration for missing variables
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
fi

# Set defaults if not defined anywhere
STYLE=${STYLE:-"curves"}
WIDTH=${WIDTH:-1080}
HEIGHT=${HEIGHT:-2400}
OUTPUT_DIR=${OUTPUT_DIR:-"$PROJECT_DIR/my_wallpapers"}

# 1. Navigate to project
cd "$PROJECT_DIR" || exit

# 2. Generate new wallpaper
# We use the full path to node to ensure it works in cron
OUT=$(/data/data/com.termux/files/usr/bin/node main.js --style "$STYLE" --width "$WIDTH" --height "$HEIGHT" --output "$OUTPUT_DIR")

# 3. Extract the filename from the output
FILE_PATH=$(echo "$OUT" | grep "Wallpaper saved to:" | cut -d ":" -f 2 | xargs)

# 4. Apply the wallpaper using termux-wallpaper
if [ -f "$FILE_PATH" ]; then
    /data/data/com.termux/files/usr/bin/termux-wallpaper -f "$FILE_PATH"
    echo "$(date): Wallpaper ($STYLE) applied: $FILE_PATH" >> "$PROJECT_DIR/wallpaper_bot.log"
else
    echo "$(date): Failed to generate or find wallpaper ($STYLE)." >> "$PROJECT_DIR/wallpaper_bot.log"
    echo "Error output: $OUT" >> "$PROJECT_DIR/wallpaper_bot.log"
fi
