# Hexa Studio — landing page

Static landing page for [Hexa Studio](https://github.com/datbe2002/hexa-studio-releases/releases),
a Windows desktop toolkit for Power Platform / Dataverse.

- `index.html` — the whole page (inline CSS/JS; Geist and Geist Mono from jsDelivr; GSAP for motion). Follows light/dark system theme and `prefers-reduced-motion`.
- `favicon.svg` — the app icon
- `media/hexa-studio-promo.mp4` + `.jpg` — the 77-second launch film shown first on the page (H.264, ~5 MB) and its poster frame

The download buttons link `/download`, a Vercel function (`api/download.js`,
routed by `vercel.json`) that reads `latest.json` from the latest release of
`datbe2002/hexa-studio-releases` and redirects to its setup.exe, so a new app
release needs no change here. It avoids the GitHub API, which allows only 60
requests an hour per IP. `/api/download?format=json` gives the page the version
and size. If GitHub can't be reached, the buttons link to the Releases page.

## Deploy on Vercel

Import this repository in Vercel with the **Other** framework preset — no build
command, output directory `.` (the repository root). Every push to `main`
redeploys.

## Preview locally

```bash
python -m http.server 5510
```

then open http://localhost:5510.
