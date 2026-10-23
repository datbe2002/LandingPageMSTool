// /changelog (vercel.json): every version's release notes, newest first, filled into
// changelog.html. ?format=json gives the same list for the page's Recent releases.
// The notes come from GitHub Releases (api/_lib/releases.js), so a new app release shows
// here without a change to this repo. If GitHub can't be reached, the page says so and
// links the Releases page.
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { RELEASES, readChangelog, esc } = require("./_lib/releases");

const template = readFileSync(join(__dirname, "..", "changelog.html"), "utf8");

function releaseHtml(r) {
  const tags = r.latest ? '<span class="tag latest">Latest</span>' : "";
  const date = r.date ? `<time datetime="${esc(r.date)}">${esc(r.dateLabel)}</time>` : "";
  const link = r.url ? `<a class="gh" href="${esc(r.url)}">Release on GitHub</a>` : "";
  return `
        <section class="rel" id="${esc(r.anchor)}" aria-labelledby="${esc(r.anchor)}-h">
          <header>
            <h2 id="${esc(r.anchor)}-h"><a href="#${esc(r.anchor)}">${esc(r.version)}</a></h2>
            ${tags}
            <p class="when">${[date, link].filter(Boolean).join('<span aria-hidden="true">·</span>')}</p>
          </header>
          <div class="notes">${r.html}</div>
        </section>`;
}

function render(data) {
  if (!data) {
    return template
      .replace("<!--toc-->", "")
      .replace("<!--latest-->", "")
      .replace(
        "<!--releases-->",
        `<div class="short"><p>The release notes can't be loaded right now. They are also on <a href="${RELEASES}">GitHub Releases</a>.</p></div>`,
      );
  }
  const { releases } = data;
  const toc = releases.map((r) => `\n        <a href="#${esc(r.anchor)}"><span>${esc(r.version)}</span><small>${esc(r.dateLabel || "")}</small></a>`).join("");
  const latest = releases[0];
  return template
    .replace("<!--toc-->", toc)
    .replace("<!--latest-->", ` · Latest: ${esc(latest.version)}${latest.dateLabel ? `, ${esc(latest.dateLabel)}` : ""}`)
    .replace("<!--releases-->", releases.map(releaseHtml).join(""));
}

module.exports = async function (req, res) {
  const asJson = req.query && req.query.format === "json";
  let data = null;
  try {
    data = await readChangelog();
  } catch (e) {
    console.error(e);
  }

  // Vercel's edge keeps the answer for 10 minutes and serves the old copy for a day while it
  // fetches a new one, so GitHub sees a handful of calls an hour. A failure is asked again soon.
  res.setHeader("Cache-Control", data ? "public, max-age=0, s-maxage=600, stale-while-revalidate=86400" : "public, max-age=0, s-maxage=30");
  if (asJson) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    if (!data) {
      res.statusCode = 502;
      res.end(JSON.stringify({ error: "release notes unavailable" }));
      return;
    }
    res.end(JSON.stringify(data));
    return;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(render(data));
};

module.exports.render = render;
