# randy.gg

Randy's site, published at https://randy.gg: one page. His link page's header, centred, then a type bar (All, Game, Art, Video, Music) and every post as the live card, filtered by type. Each card goes to the post on Steam or YouTube, or opens a piece hosted here (a painting, a track) fullscreen.

## Layout

- `content/posts/YYYY-MM-DD-slug.md`: a post, front matter only (`build.mjs`'s header lists it). `content/media/` holds the media; `tools/encode.sh` makes a hosted piece's web copies.
- `build.mjs`: one Node script, no dependencies, writes `site/index.html` from the posts. Its output is committed, so Pages runs no build (Oct 2026, supply chain).
- `site/`: what gets served. Everything but `index.html` and `assets/media/` is hand-kept: `site/assets/` (stylesheet, script, logo, icons), the short-path redirect pages, the sitemap.

To add a post: drop its media in `content/media/`, add its file to `content/posts/`, run `node build.mjs` and commit `site/` with it. Preview with any static server, e.g. `python3 -m http.server -d site`.

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`, which uploads `site/` to **GitHub Pages** (actions pinned by commit SHA). The custom domain is `randy.gg` (`site/CNAME`); Cloudflare proxies it and handles DNS and HTTPS.

Check the [deployment runs](https://github.com/randyprime/randygg/actions/workflows/deploy.yml) and the [live site](https://randy.gg) after a push. The old `bigrando420/linktree` URL redirects here.

`tools/preview.sh` uploads a noindexed copy to the unlisted Cloudflare Pages project `randygg-preview` (https://randygg-preview.pages.dev) for review before anything goes public.

Short paths such as `/terrafactor` are `site/<path>/index.html` refresh pages: copy one to add another. Pages serves them as 200, not an HTTP redirect.
