#!/usr/bin/env bash
# Encodes a post's media for the web, by the output's extension. Nices itself. A track's flac streams as is; it needs
# only its waveform.
#   .mp4  a timelapse, from his own Make video render as is, preview and end hold included, nothing cut (Nov 19 2026:
#         "it should be the same as the actual vid I've got myside"): H.264 High yuv420p, at most 1920 on its long side,
#         level 4.2 (5.0 for a frame past 4.2's size), BT.709 tagged, faststart, silent, a keyframe every half second so
#         it scrubs smoothly
#   .webp an image for the card and the viewer: at most 2560 on its long side (the original stays the download)
#   .peaks.json  a track's waveform, beside its file (NAME.flac -> NAME.peaks.json): 200 loudness bars, 0 to 1
# Usage: tools/encode.sh <source> <content/media/...>, then node build.mjs
set -euo pipefail
in=${1:?source file}
out=${2:?output file}
mkdir -p "$(dirname "$out")"
case "$out" in
  *.mp4) IFS=x read -r w h < <(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$in")
    m=$(( w > h ? w : h )); k=$(( m > 1920 ? 1920 : m ))
    level=4.2; [ $(( ((w * k / m + 15) / 16) * ((h * k / m + 15) / 16) )) -le 8704 ] || level=5.0
    nice -n 10 ffmpeg -hide_banner -loglevel error -y -i "$in" -an \
      -vf "scale='min(1920,iw)':'min(1920,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos,format=yuv420p" \
      -c:v libx264 -preset slow -crf 22 -g 15 -maxrate 8M -bufsize 16M -profile:v high -level:v "$level" \
      -color_primaries bt709 -color_trc bt709 -colorspace bt709 -movflags +faststart "$out" ;;
  *.webp) nice -n 10 convert "$in" -resize '2560x2560>' -quality 85 -define webp:method=6 "$out" ;;
  *.peaks.json) nice -n 10 ffmpeg -hide_banner -loglevel error -i "$in" -ac 1 -ar 8000 -f s16le - | nice -n 10 node -e '
      const chunks = [];
      process.stdin.on("data", c => chunks.push(c)).on("end", () => {
        const pcm = Buffer.concat(chunks), n = pcm.length >> 1, bars = 200, rms = [];
        for (let i = 0; i < bars; i++) {
          let sum = 0, a = Math.floor((i * n) / bars), b = Math.floor(((i + 1) * n) / bars);
          for (let j = a; j < b; j++) sum += (pcm.readInt16LE(j * 2) / 32768) ** 2;
          rms.push(Math.sqrt(sum / Math.max(1, b - a)));
        }
        const top = Math.max(...rms) || 1;
        process.stdout.write(JSON.stringify(rms.map(v => +(v / top).toFixed(3))) + "\n");
      });' > "$out" ;;
  *) echo "encode: output must be .mp4, .webp or .peaks.json" >&2; exit 2 ;;
esac
ls -l "$out"
