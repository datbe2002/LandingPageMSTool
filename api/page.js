// / (vercel.json): page.html with the content published in the admin dashboard.
// The content comes from the license status Worker's public /v1/site; ?preview=<token>
// (a link the dashboard makes) asks for the draft instead. If the Worker can't be reached
// in time, the page goes out as page.html says, so the site never depends on it.
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { render } = require("./_lib/render");

const SITE_URL = process.env.SITE_CONFIG_URL || "https://hexa-license-status.hexastudio.workers.dev/v1/site";
const TIMEOUT_MS = 2500;

const template = readFileSync(join(__dirname, "..", "page.html"), "utf8");

async function readConfig(preview) {
  const url = preview ? `${SITE_URL}?preview=${encodeURIComponent(preview)}` : SITE_URL;
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`site config: ${res.status}`);
  return (await res.json()).config;
}

module.exports = async function (req, res) {
  const preview = typeof req.query?.preview === "string" && /^[\w-]{8,64}$/.test(req.query.preview) ? req.query.preview : null;
  let config = null;
  let ok = true;
  try {
    config = await readConfig(preview);
  } catch (e) {
    ok = false;
    console.error(e);
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (preview) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex");
  } else {
    // Vercel's edge keeps the page a minute, then serves the old copy while it fetches a new one.
    // When the config couldn't be read, it asks again sooner.
    res.setHeader("Cache-Control", ok ? "public, max-age=0, s-maxage=60, stale-while-revalidate=600" : "public, max-age=0, s-maxage=10");
  }
  if (preview && !ok) {
    res.statusCode = 403;
    res.end(render(template, null).replace("</body>", '  <div class="preview-bar" role="status">This preview link has expired. Make a new one in the dashboard.</div>\n</body>'));
    return;
  }
  res.end(render(template, config, { preview: !!preview }));
};
