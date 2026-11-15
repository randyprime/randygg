#!/usr/bin/env bash
# Builds the site and uploads it to the unlisted Cloudflare Pages preview (randygg-preview.pages.dev).
# The upload is noindexed (robots Disallow, X-Robots-Tag); site/ itself is untouched.
# Needs /secrets/cloudflare.env (IP-locked to hetzbox and gpubox). Nices its own build. Usage: tools/preview.sh
set -euo pipefail
cd "$(dirname "$0")/.."
PROJECT=randygg-preview
STAGE=/var/tmp/agents/randygg-preview/stage

nice -n 10 node build.mjs
rm -rf "${STAGE:?}"
mkdir -p "$STAGE"
cp -r site/. "$STAGE/"
rm -f "$STAGE/CNAME" "$STAGE/sitemap.xml"
printf 'User-agent: *\nDisallow: /\n' > "$STAGE/robots.txt"
printf '/*\n  X-Robots-Tag: noindex, nofollow\n' > "$STAGE/_headers"

set -a; . /secrets/cloudflare.env; set +a
wrangler pages deploy "$STAGE" --project-name "$PROJECT" --branch main --commit-dirty=true
echo "https://$PROJECT.pages.dev/"
