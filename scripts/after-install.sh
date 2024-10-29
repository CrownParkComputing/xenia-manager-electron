#!/bin/bash

# Update desktop database
update-desktop-database || true

# Ensure wine is installed
if ! command -v wine &> /dev/null; then
    echo "Wine is required but not installed. Please install wine to run Xenia Manager."
    exit 0
fi

# Create default wine prefix if it doesn't exist
if [ ! -d "$HOME/.wine" ]; then
    echo "Creating default wine prefix..."
    WINEARCH=win64 WINEPREFIX="$HOME/.wine" wineboot -u
fi

exit 0
