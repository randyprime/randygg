#!/usr/bin/env bash
# Builds the site and uploads it to the unlisted Cloudflare Pages preview (randygg-preview.pages.dev).
# The upload is noindexed (robots Disallow, X-Robots-Tag); site/ itself is untouched.
# A branch other than main lands on its own alias, https://<branch>.randygg-preview.pages.dev/, to compare variants.
# While tools/designs/ exists, the upload carries its design switcher. --local stages without uploading.
# Needs /secrets/cloudflare.env (IP-locked to hetzbox and gpubox). Nices its own build.
# Usage: tools/preview.sh [branch | --local]
set -euo pipefail
cd "$(dirname "$0")/.."
PROJECT=randygg-preview
BRANCH=${1:-main}
STAGE=/var/tmp/agents/randygg-preview/stage

nice -n 10 node build.mjs
rm -rf "${STAGE:?}"
mkdir -p "$STAGE"
cp -r site/. "$STAGE/"
rm -f "$STAGE/CNAME" "$STAGE/sitemap.xml"
printf 'User-agent: *\nDisallow: /\n' > "$STAGE/robots.txt"
printf '/*\n  X-Robots-Tag: noindex, nofollow\n' > "$STAGE/_headers"
[ -d tools/designs ] && node tools/designs/inject.mjs "$STAGE"
[ "$BRANCH" = --local ] && { echo "$STAGE"; exit 0; }

set -a; . /secrets/cloudflare.env; set +a
wrangler pages deploy "$STAGE" --project-name "$PROJECT" --branch "$BRANCH" --commit-dirty=true
if [ "$BRANCH" = main ]; then echo "https://$PROJECT.pages.dev/"; else echo "https://$BRANCH.$PROJECT.pages.dev/"; fi
