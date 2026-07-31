#!/bin/bash

# Configuration File Path
CONFIG_FILE="config.env"

# Load existing values if the file exists
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
fi

# Set defaults if not already set
STYLE=${STYLE:-"curves"}
WIDTH=${WIDTH:-1080}
HEIGHT=${HEIGHT:-2400}
OUTPUT_DIR=${OUTPUT_DIR:-"/data/data/com.termux/files/home/dev/wallgen/my_wallpapers"}

echo "--- Generative Wallpaper Framework Configurator ---"

# Style selection
echo ""
echo "Available Styles:"
echo "1) curves (Flowing glowing paths)"
echo "2) grid   (Geometric rotating polygons)"
echo "3) glitch (Retro digital artifacts)"
echo "4) smoke  (Crystal smoke tendrils)"
echo "5) nebula (Nebula constellations)"
echo "6) fractal(Recursive geometric patterns)"
echo "7) zigzag (Angled fractal lines)"
echo "8) expressive (Material-style layered shapes)"
echo "9) helix  (DNA-like double helix structures)"
echo "10) circuit (Cyber circuit board hardware)"
echo "11) energy (Twisting 3D vortex energy flows)"
echo "12) synapse (High-tech neural data web)"
echo "13) liquidsteel (Swirling liquid metal)"
echo "14) trill (Postmodern abstract arrangements)"
echo "15) mandala (2.5D radial patterns)"
echo "16) trap (Postmodern crystalline smoke)"
echo "17) smoke2 (Experimental Crystal Smoke)"
echo "18) oil    (Fluid iridescent oil-on-water)"
echo "19) beveled (Beveled, embossed 3D circuit board lines)"
echo "20) plasmo (Smooth stirred lava blobs on AMOLED black)"
echo ""

read -p "Select a style [Current: $STYLE]: " style_choice

case $style_choice in
    1) STYLE="curves" ;;
    2) STYLE="grid" ;;
    3) STYLE="glitch" ;;
    4) STYLE="smoke" ;;
    5) STYLE="nebula" ;;
    6) STYLE="fractal" ;;
    7) STYLE="zigzag" ;;
    8) STYLE="expressive" ;;
    9) STYLE="helix" ;;
    10) STYLE="circuit" ;;
    11) STYLE="energy" ;;
    12) STYLE="synapse" ;;
    13) STYLE="liquidsteel" ;;
    14) STYLE="trill" ;;
    15) STYLE="mandala" ;;
    16) STYLE="trap" ;;
    17) STYLE="smoke2" ;;
    18) STYLE="oil" ;;
    19) STYLE="beveled" ;;
    20) STYLE="plasmo" ;;
    *) 
        if [ ! -z "$style_choice" ]; then
            STYLE=$style_choice
        fi
        ;;
esac

# Width and Height
read -p "Width [Current: $WIDTH]: " input_width
WIDTH=${input_width:-$WIDTH}

read -p "Height [Current: $HEIGHT]: " input_height
HEIGHT=${input_height:-$HEIGHT}

# Output Directory
read -p "Output Directory [Current: $OUTPUT_DIR]: " input_dir
OUTPUT_DIR=${input_dir:-$OUTPUT_DIR}

# Write to config.env
cat <<EOF > "$CONFIG_FILE"
STYLE="$STYLE"
WIDTH=$WIDTH
HEIGHT=$HEIGHT
OUTPUT_DIR="$OUTPUT_DIR"
EOF

echo ""
echo "Configuration saved to $CONFIG_FILE:"
cat "$CONFIG_FILE"
echo ""
echo "Done!"
