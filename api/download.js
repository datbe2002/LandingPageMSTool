// /download: sends the visitor straight to the newest installer.
// It reads latest.json, the file the app's own updater reads, from GitHub
// Releases, so it never uses the GitHub API and its 60 requests an hour per IP.
// ?format=json returns the version, file name and size for the page instead.
const RELEASES = "https://github.com/datbe2002/hexa-studio-releases/releases";

module.exports = async function (req, res) {
  const asJson = req.query && req.query.format === "json";
  try {
    const r = await fetch(RELEASES + "/latest/download/latest.json");
    if (!r.ok) throw new Error("latest.json: " + r.status);
    const latest = await r.json();
    const url = latest.platforms["windows-x86_64"].url;

    // Vercel's edge keeps the answer for 5 minutes, so a new release shows up within that.
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=86400");
    if (asJson) {
      const head = await fetch(url, { method: "HEAD" });
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({
        version: latest.version,
        published: latest.pub_date,
        url: url,
        name: decodeURIComponent(url.split("/").pop()),
        size: Number(head.headers.get("content-length")) || null,
      }));
      return;
    }
    res.statusCode = 302;
    res.setHeader("Location", url);
    res.end();
  } catch (e) {
    // GitHub unreachable or latest.json missing: fall back to the Releases page.
    res.setHeader("Cache-Control", "no-store");
    if (asJson) {
      res.statusCode = 502;
      res.end();
      return;
    }
    res.statusCode = 302;
    res.setHeader("Location", RELEASES + "/latest");
    res.end();
  }
};
