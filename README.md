# Hexa Studio — landing page

Static landing page for [Hexa Studio](https://github.com/datbe2002/hexa-studio-releases/releases),
a Windows desktop toolkit for Power Platform / Dataverse.

- `page.html` — the whole page (inline CSS/JS; Geist and Geist Mono self-hosted; GSAP for motion). Honors `prefers-reduced-motion`.
  It is a template: `/` is served by `api/page.js`, which fills it with the content
  published in the license admin dashboard (see below).
- `favicon.svg` — the app icon
- `media/hexa-studio-promo.mp4` + `.jpg` — the 77-second launch film shown first on the page (H.264, ~5 MB) and its poster frame

The download buttons link `/download`, a Vercel function (`api/download.js`,
routed by `vercel.json`) that reads `latest.json` from the latest release of
`datbe2002/hexa-studio-releases` and redirects to its setup.exe, so a new app
release needs no change here. It avoids the GitHub API, which allows only 60
requests an hour per IP. `/api/download?format=json` gives the page the version
and size. If GitHub can't be reached, the buttons link to the Releases page.

## Changelog and Recent releases

`/changelog` (`api/changelog.js`, template `changelog.html`) lists every version's release
notes, newest first; the page's **Recent releases** section shows the newest three from
`/api/changelog?format=json`, each linking to its notes. Nothing to edit here for a new
release: the app's release workflow publishes `.github/release-notes.md` as each GitHub
release's body, and that file keeps a `### What's new in x.y.z` section for every version,
so the newest body is the whole changelog (`api/_lib/releases.js` parses it; the date of
each version comes from its release, or from `EARLIER_DATES` for the ones before
`hexa-studio-releases` existed). This uses one GitHub API call, cached by Vercel's edge for
10 minutes; set a `GITHUB_TOKEN` environment variable on Vercel if the 60-an-hour limit is
ever hit. If GitHub can't be reached, the page says so and the section keeps its link.
Tests: `node --test tests/releases.test.js`.

## Content from the admin dashboard

The hero, an announcement strip, which sections show, the pricing, the contact address
and the page title/description are edited in the admin dashboard
(`hexa-license-admin`, *Landing page › Content*) and published from there; no commit
or redeploy here.

- `page.html` marks each editable spot `<!--cms:key-->built-in content<!--/cms:key-->`,
  and each section that can be hidden `data-cms-section` (its menu links `data-cms-nav`).
- `api/page.js` reads the published content from
  `https://hexa-license-status.hexastudio.workers.dev/v1/site` (2.5 s timeout) and renders
  it with `api/_lib/render.js`. Vercel's edge keeps the page for a minute, so a publish
  shows within about two minutes. If the Worker can't be reached, or nothing is published,
  the page goes out exactly as `page.html` says.
- `/?preview=<token>` shows the draft (the dashboard's *Preview* button makes the link,
  valid for an hour), labelled as a preview and kept out of search.
- A text change to a part that isn't editable is still a commit to `page.html`. Keep the
  markers around the editable parts when editing them by hand.
- Tests: `node --test tests/render.test.js tests/releases.test.js`.

## Deploy on Vercel

Import this repository in Vercel with the **Other** framework preset — no build
command, output directory `.` (the repository root). Every push to `main`
redeploys.

## Preview locally

```bash
node scripts/dev.js
```

then open http://localhost:5510. It serves `/` through `api/page.js` like Vercel, with the
live published content; `node scripts/dev.js --site=http://localhost:8788/v1/site` reads a
local status Worker instead.
