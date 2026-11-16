#!/usr/bin/env bash
# Encodes a post's media for the web, by the output's extension. Nices itself. A track needs none: its flac streams as is.
#   .mp4  a timelapse: H.264 High yuv420p, at most 1920 wide, level 4.2, BT.709 tagged, faststart, silent
#   .webp an image for the card and the viewer: at most 2560 wide (the original stays the download)
# Usage: tools/encode.sh <source> <content/media/...>, then node build.mjs
set -euo pipefail
in=${1:?source file}
out=${2:?output file}
mkdir -p "$(dirname "$out")"
case "$out" in
  *.mp4) nice -n 10 ffmpeg -hide_banner -loglevel error -y -i "$in" -an \
      -vf "scale='min(1920,iw)':-2:flags=lanczos,format=yuv420p" \
      -c:v libx264 -preset slow -crf 22 -maxrate 8M -bufsize 16M -profile:v high -level:v 4.2 \
      -color_primaries bt709 -color_trc bt709 -colorspace bt709 -movflags +faststart "$out" ;;
  *.webp) nice -n 10 convert "$in" -resize '2560x>' -quality 85 -define webp:method=6 "$out" ;;
  *) echo "encode: output must be .mp4 or .webp" >&2; exit 2 ;;
esac
ls -l "$out"
