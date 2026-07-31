#!/data/data/com.termux/files/usr/bin/bash

# Generative Wallpaper Framework - Pool & Rotation Script
PROJECT_DIR="/data/data/com.termux/files/home/dev/wallgen"
CONFIG_FILE="$PROJECT_DIR/config.env"
LOG_FILE="$PROJECT_DIR/wallpaper_bot.log"
NODE_BIN="/data/data/com.termux/files/usr/bin/node"
TERMUX_WALLPAPER="/data/data/com.termux/files/usr/bin/termux-wallpaper"

# Ensure we are in the project directory
cd "$PROJECT_DIR" || { echo "Could not cd to $PROJECT_DIR"; exit 1; }

show_help() {
    echo "Usage: ./update_wallpaper.sh [options]"
    echo "Options:"
    echo "  --rotate       Only rotate to the next wallpaper in the pool (skip generation)"
    echo "  --count <n>    Number of wallpapers to generate (default: 10)"
    echo "  --style <name> Override style from config"
    echo "  --width <px>   Override width"
    echo "  --height <px>  Override height"
    echo "  --help         Show this help"
}

# Defaults
COUNT=10
MAX_POOL=30
ROTATE_ONLY=false

# Handle CLI arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --help) show_help; exit 0 ;;
        --rotate) ROTATE_ONLY=true ;;
        --count) COUNT="$2"; shift ;;
        --style) STYLE="$2"; shift ;;
        --width) WIDTH="$2"; shift ;;
        --height) HEIGHT="$2"; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
    shift
done

# Load config
[ -f "$CONFIG_FILE" ] && source "$CONFIG_FILE"

# Final values
STYLE=${STYLE:-"expressive"}
WIDTH=${WIDTH:-1080}
HEIGHT=${HEIGHT:-2400}
OUTPUT_DIR=${OUTPUT_DIR:-"$PROJECT_DIR/my_wallpapers"}
POOL_DIR="$OUTPUT_DIR/pool"
LAST_GEN_FILE="$POOL_DIR/.last_gen_hour"
IDX_FILE="$POOL_DIR/.last_idx"
GEN_LOCK="$POOL_DIR/.gen_lock"

# Function to rotate wallpaper
rotate_wallpaper() {
    if [ -d "$POOL_DIR" ]; then
        FILES=($(ls -v "$POOL_DIR"/*.png 2>/dev/null))
        NUM_FILES=${#FILES[@]}

        if [ "$NUM_FILES" -gt 0 ]; then
            LAST_IDX=$(cat "$IDX_FILE" 2>/dev/null || echo -1)
            IDX=$(( (LAST_IDX + 1) % NUM_FILES ))
            
            # If the file at current index doesn't exist (e.g. after pruning), find the next one
            while [ ! -f "${FILES[$IDX]}" ] && [ "$NUM_FILES" -gt 0 ]; do
                IDX=$(( (IDX + 1) % NUM_FILES ))
            done

            echo "$IDX" > "$IDX_FILE"

            SELECTED_FILE="${FILES[$IDX]}"
            if [ -f "$SELECTED_FILE" ]; then
                echo "[$(date)] Rotating to wallpaper index $IDX: $SELECTED_FILE" >> "$LOG_FILE"
                $TERMUX_WALLPAPER -f "$SELECTED_FILE"
                $TERMUX_WALLPAPER -f "$SELECTED_FILE" -l
                return 0
            fi
        fi
    fi
    return 1
}

# 1. Immediate Rotation
echo "[$(date)] Update triggered (Style: $STYLE)" >> "$LOG_FILE"
if ! rotate_wallpaper; then
    echo "[$(date)] Pool empty or rotation failed. Generating initial wallpaper in foreground..." >> "$LOG_FILE"
    mkdir -p "$POOL_DIR"
    $NODE_BIN main.js --style "$STYLE" --width "$WIDTH" --height "$HEIGHT" --output "$POOL_DIR" > /dev/null 2>&1
    rotate_wallpaper
fi

# 2. Background Generation Phase
if [ "$ROTATE_ONLY" = false ]; then
    CURRENT_HOUR=$(date +%Y%m%d%H)
    LAST_GEN_HOUR=$(cat "$LAST_GEN_FILE" 2>/dev/null)
    POOL_SIZE=$(ls "$POOL_DIR"/*.png 2>/dev/null | wc -l)

    # Trigger background generation if it's a new hour OR pool is getting low
    if [ "$CURRENT_HOUR" != "$LAST_GEN_HOUR" ] || [ "$POOL_SIZE" -lt 5 ]; then
        
        # Check if already generating
        if [ -f "$GEN_LOCK" ]; then
            LPID=$(cat "$GEN_LOCK")
            if kill -0 "$LPID" 2>/dev/null; then
                echo "[$(date)] Generation already in progress (PID: $LPID). Skipping." >> "$LOG_FILE"
                exit 0
            fi
        fi

        # Run in subshell in background
        (
            echo $$ > "$GEN_LOCK"
            echo "[$(date)] Starting background generation of $COUNT wallpapers" >> "$LOG_FILE"
            
            for i in $(seq 1 "$COUNT"); do
                $NODE_BIN main.js --style "$STYLE" --width "$WIDTH" --height "$HEIGHT" --output "$POOL_DIR" > /dev/null 2>&1
            done
            
            # Pruning old wallpapers (oldest first)
            ALL_FILES=($(ls -t "$POOL_DIR"/*.png 2>/dev/null | tac))
            TOTAL=${#ALL_FILES[@]}
            if [ "$TOTAL" -gt "$MAX_POOL" ]; then
                REMOVE_COUNT=$((TOTAL - MAX_POOL))
                echo "[$(date)] Pruning $REMOVE_COUNT old wallpapers" >> "$LOG_FILE"
                for i in $(seq 0 $((REMOVE_COUNT - 1))); do
                    rm -f "${ALL_FILES[$i]}"
                done
                # We don't reset index to -1 here anymore to avoid repeats. 
                # The rotation logic handles missing files or index overflows.
            fi

            echo "$CURRENT_HOUR" > "$LAST_GEN_FILE"
            rm -f "$GEN_LOCK"
            echo "[$(date)] Background generation finished" >> "$LOG_FILE"
        ) &
    fi
fi
