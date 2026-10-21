// Local preview: node scripts/dev.js [port] [--site=<url of /v1/site>]  (default port 5510)
// Serves the folder like Vercel does, with / rendered by api/page.js, so what you see is
// what Vercel serves. The content comes from SITE_CONFIG_URL (default: the live
// /v1/site), or --site=http://localhost:8788/v1/site for a local status Worker.
const http = require("node:http");
const { readFile } = require("node:fs/promises");
const { extname, join, normalize } = require("node:path");
const site = process.argv.find((a) => a.startsWith("--site="));
if (site) process.env.SITE_CONFIG_URL = site.slice("--site=".length);
const page = require("../api/page");
const download = require("../api/download");

const ROOT = join(__dirname, "..");
const PORT = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a))) || 5510;
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".mp4": "video/mp4", ".jpg": "image/jpeg", ".png": "image/png", ".txt": "text/plain" };

/** Just enough of Vercel's req/res for the two functions. */
function vercelish(req, res) {
  const url = new URL(req.url, "http://localhost");
  req.query = Object.fromEntries(url.searchParams);
  res.status = (code) => ((res.statusCode = code), res);
  return url;
}

http
  .createServer(async (req, res) => {
    const url = vercelish(req, res);
    try {
      if (url.pathname === "/" || url.pathname === "/index.html") return await page(req, res);
      if (url.pathname === "/download" || url.pathname === "/api/download") return await download(req, res);
      const file = normalize(join(ROOT, decodeURIComponent(url.pathname)));
      if (!file.startsWith(ROOT) || /[\\/](api|scripts|tests|\.git)[\\/]/.test(file.slice(ROOT.length))) throw Object.assign(new Error("nope"), { code: "ENOENT" });
      const body = await readFile(file);
      res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
      res.end(body);
    } catch (e) {
      res.writeHead(e.code === "ENOENT" || e.code === "EISDIR" ? 404 : 500, { "Content-Type": "text/plain" });
      res.end(e.code === "ENOENT" || e.code === "EISDIR" ? "Not found" : String(e));
    }
  })
  .listen(PORT, () => console.log(`Landing page on http://localhost:${PORT}`));
