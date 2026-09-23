# Hexa Studio — landing page

Static landing page for [Hexa Studio](https://github.com/datbe2002/MSDataverseTool),
a Windows desktop toolkit for Power Platform / Dataverse.

- `index.html` — the whole page (inline CSS/JS, Google Fonts for IBM Plex Sans and JetBrains Mono)
- `favicon.svg` — the app icon

The download buttons ask the GitHub API for the latest release of
`datbe2002/MSDataverseTool` and link its `*setup.exe`, so a new app release
needs no change here. If the API can't be reached, they link to the Releases page.

## Deploy on Vercel

Import this repository in Vercel with the **Other** framework preset — no build
command, output directory `.` (the repository root). Every push to `main`
redeploys.

## Preview locally

```bash
python -m http.server 5510
```

then open http://localhost:5510.
