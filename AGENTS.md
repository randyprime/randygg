# randy.gg

Randy's public site. Read README.md first.

- Public means public: pushing `main` deploys https://randy.gg. Push or change anything public only on Randy's word. Review happens on `tools/preview.sh` (unlisted, noindexed).
- Work on `main`. The local tag `margin-notes-v1` is the parked margin-notes build, and its history holds a private image (Nov 14 2026: "don't publish the faces study"), so it is never pushed.
- Dark only (Nov 14 2026: "fully dark mode, I hate light"): no light theme, no device switch.
- One page (Nov 16 2026, B picked over the featured card: "no featured post, center the randy thing and then just have the posts underneath"): the link page's header centred (photo, wordmark, line, links), under it the type bar (All, Game, Art, Video, Music) and every post as that card, the first row peeking above the fold as the cue to scroll. No carousel ("kill the switcher"). Every card is the live card ("my fav layout of the card"): image, then one bar with the source's icon, the title, how long ago and no date ("just remove the date and keep the 2 weeks ago"), the arrow. A card goes straight to the post where it lives, in the same tab ("yup normal is best"); a piece hosted here (art, music) opens fullscreen on dark instead, with a download of the original (Nov 16 2026). No short descriptions yet ("don't even build out a short desc system yet"). Build anything new from that page's own materials.
- No writing on the site for now: his older writing stays in his vault, and the margin-notes reading pages wait at that tag until he wants them.
- No packages: `build.mjs` stays one dependency-free file and its output is committed.
- Run `node build.mjs` after any content or build change; screenshot headlessly with `tools/shoot.mjs` under `xvfb-run -a nice -n 10`.
