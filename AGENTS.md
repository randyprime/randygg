# randy.gg

Randy's public site. Read README.md first.

- Public means public: pushing `main` deploys https://randy.gg. Push or change anything public only on Randy's word. Review happens on `tools/preview.sh` (unlisted, noindexed).
- Go-live starts by squashing `archive` into one commit on `main`: its history holds a private image removed on Randy's word (Nov 14 2026: "don't publish the faces study"), and history must never reach the public repo. The local tag `margin-notes-v1` points into that history too: never push tags.
- Dark only (Nov 14 2026: "fully dark mode, I hate light"): no light theme, no device switch.
- One page, and it lands as one screen (Nov 14 2026: "we still want to single page this top area so it feels elegant on landing"): the link page as it has always been (photo, wordmark, line, links, one card), the card his newest post, "one key thing on the screen". A quiet "Show more" under it scrolls down to the gallery, every post as that card. No switcher or carousel ("kill the switcher"). Every card is the live card ("my fav layout of the card"): image, then one bar with the source's icon, the title, how long ago and no date ("just remove the date and keep the 2 weeks ago"), the arrow. A card goes straight to the post where it lives, in the same tab ("yup normal is best"). Build anything new from that page's own materials.
- No writing on the site for now: his older writing stays in his vault, and the reading pages with margin notes are parked at the tag `margin-notes-v1` until he wants them.
- No packages: `build.mjs` stays one dependency-free file and its output is committed.
- Run `node build.mjs` after any content or build change; screenshot headlessly with `tools/shoot.mjs` under `xvfb-run -a nice -n 10`.
