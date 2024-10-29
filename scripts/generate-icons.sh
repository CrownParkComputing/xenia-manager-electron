#!/bin/bash

# Create icons directory if it doesn't exist
mkdir -p build/icons

# Convert the icon to PNG format in various sizes
magick assets/icon.ico -resize 16x16 build/icons/16x16.png
magick assets/icon.ico -resize 32x32 build/icons/32x32.png
magick assets/icon.ico -resize 48x48 build/icons/48x48.png
magick assets/icon.ico -resize 64x64 build/icons/64x64.png
magick assets/icon.ico -resize 128x128 build/icons/128x128.png
magick assets/icon.ico -resize 256x256 build/icons/256x256.png
magick assets/icon.ico -resize 512x512 build/icons/512x512.png

# Create icon.png (will be used as the main icon)
cp build/icons/256x256.png build/icon.png

# Copy ico file for Windows
cp assets/icon.ico build/icon.ico
