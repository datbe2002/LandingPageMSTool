// The release notes of every Hexa Studio version, for /changelog and the page's Recent releases.
// The app's release workflow publishes .github/release-notes.md as the body of each GitHub
// release, and that file keeps every version's "### What's new in x.y.z" section, so the
// newest release's body is the whole changelog. One GitHub API call lists the releases
// (body + date); Vercel's edge caches the answer, so the 60 requests an hour per IP the API
// allows without a token are plenty. GITHUB_TOKEN, if set, lifts that limit.
const REPO = "datbe2002/hexa-studio-releases";
const RELEASES = `https://github.com/${REPO}/releases`;
const API = `https://api.github.com/repos/${REPO}/releases?per_page=100`;
const TIMEOUT_MS = 4000;

// Versions released before the releases repo existed: their notes are in every body, their
// dates only in the app repo's tags.
const EARLIER_DATES = {
  "0.9.0": "2026-10-13",
  "0.8.0": "2026-10-08",
  "0.7.0": "2026-10-03",
  "0.6.0": "2026-10-03",
  "0.5.0": "2026-10-03",
  "0.4.0": "2026-09-25",
  "0.3.1": "2026-09-24",
  "0.3.0": "2026-09-24",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const esc = (text) =>
  String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** **bold**, *italic*, `code` and [text](https://…) links; everything else is escaped. */
function inline(text) {
  const codes = [];
  let html = esc(text).replace(/`([^`]+)`/g, (w, c) => `\u0000${codes.push(c) - 1}\u0000`);
  html = html
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, "$1<em>$2</em>")
    .replace(/\[([^\]]*)\]\(([^)\s]*)\)/g, (whole, label, url) =>
      /^https:\/\/[^\s"]+$/.test(url.replace(/&amp;/g, "&")) ? `<a href="${url}">${label}</a>` : label,
    );
  return html.replace(/\u0000(\d+)\u0000/g, (w, i) => `<code>${codes[i]}</code>`);
}

/** Plain text of a line of markdown, for the short summaries. */
const plain = (text) =>
  String(text)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*`]/g, "")
    .trim();

function shorten(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).replace(/[\s,;:.—-]+$/, "") + "…";
}

/**
 * One version's section of the notes as HTML: a line that is all bold ("**Flows**", or
 * "**Connection references** (…) — what it is") starts a group, "- " lines are its list,
 * indented "- " lines nest under the item above, other lines are paragraphs.
 */
function sectionHtml(lines) {
  const blocks = [];
  let list = null; // the list being filled: [{ text, children: [text] }]
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const item = /^(\s*)[-*] (.*)$/.exec(raw);
    if (item) {
      if (!list) blocks.push((list = []));
      const text = item[2].trim();
      if (item[1].length >= 2) {
        if (!list.length) list.push({ text: "", children: [] });
        list[list.length - 1].children.push(text);
      } else {
        list.push({ text, children: [] });
      }
      continue;
    }
    list = null;
    const group = /^\*\*([^*]+)\*\*(.*)$/.exec(raw.trim());
    if (group) {
      // "**Connection references** (Power Automate › Connections) — every …": the place goes in the heading.
      const where = /^\s*(\([^)]*\))/.exec(group[2]);
      blocks.push(`<h3>${inline(group[1].trim())}${where ? ` <small>${inline(where[1])}</small>` : ""}</h3>`);
      const rest = group[2].slice(where ? where[0].length : 0).trim().replace(/^[—–-]\s*/, "");
      if (rest) blocks.push(`<p>${inline(rest.charAt(0).toUpperCase() + rest.slice(1))}</p>`);
    } else {
      blocks.push(`<p>${inline(raw.trim())}</p>`);
    }
  }
  const ul = (items) => `<ul>${items.join("")}</ul>`;
  return blocks
    .map((b) =>
      typeof b === "string"
        ? b
        : ul(b.map((i) => `<li>${inline(i.text)}${i.children.length ? ul(i.children.map((c) => `<li>${inline(c)}</li>`)) : ""}</li>`)),
    )
    .join("\n");
}

/**
 * Up to `max` short lines saying what a version brought, as { title, text }: its groups with
 * the first thing each says, else its first items ("**New task** — pick …" → title "New task").
 */
function highlights(lines, max = 3) {
  const groups = [];
  const items = [];
  for (const raw of lines) {
    const group = /^\*\*([^*]+)\*\*(.*)$/.exec(raw.trim());
    if (group) {
      const rest = plain(group[2].replace(/^\s*\([^)]*\)/, "").trim().replace(/^[—–-]\s*/, ""));
      groups.push({ title: plain(group[1]), text: rest ? shorten(rest.charAt(0).toUpperCase() + rest.slice(1), 90) : "" });
    } else if (/^[-*] /.test(raw)) {
      const line = raw.slice(2).trim();
      const named = /^\*\*([^*]+)\*\*\s*(?:([—–:-])\s*(.*))?$/.exec(line);
      // After a dash the rest is a new sentence ("— pick where …" → "Pick where …"); after a colon it isn't.
      const rest = named && named[3] ? plain(named[3]).replace(/:$/, "") : "";
      const item = named
        ? { title: plain(named[1]), text: shorten(named[2] === ":" ? rest : rest.replace(/^./, (c) => c.toUpperCase()), 90) }
        : { title: "", text: shorten(plain(line), 110) };
      items.push(item);
      const last = groups[groups.length - 1];
      // A group with no words of its own says what its first item says.
      if (last && !last.text) last.text = item.title ? (item.text ? `${item.title}: ${item.text}` : item.title) : shorten(item.text, 90);
    }
  }
  const named = groups.filter((g) => !/^(also|everywhere)$/i.test(g.title));
  return named.length >= 2 ? named.slice(0, max) : items.slice(0, max);
}

/** The notes of each version in `body`, newest first: [{ version, html, highlights }]. */
function parseNotes(body) {
  const versions = [];
  let current = null;
  for (const line of String(body || "").replace(/\r/g, "").split("\n")) {
    const head = /^###\s+(.*)$/.exec(line);
    if (head) {
      const v = /^What['’]s new in v?(\d+\.\d+\.\d+)\s*$/i.exec(head[1].trim());
      current = v ? { version: v[1], lines: [] } : null; // Download, Requirements…: not a version
      if (current) versions.push(current);
      continue;
    }
    if (current) current.lines.push(line);
  }
  return versions.map((v) => ({ version: v.version, html: sectionHtml(v.lines), highlights: highlights(v.lines) }));
}

/** "2026-10-21" or an ISO time → "21 Oct 2026". */
function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : null;
}

const anchor = (version) => "v" + version.replace(/\./g, "-");

/**
 * The changelog from the list the GitHub API gives:
 * { releases: [{ version, date, dateLabel, url, anchor, latest, highlights, html }] }.
 */
function changelog(list) {
  const published = (Array.isArray(list) ? list : []).filter((r) => r && !r.draft && !r.prerelease && typeof r.tag_name === "string");
  if (!published.length) throw new Error("no published releases");
  published.sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)));
  const byVersion = new Map(published.map((r) => [r.tag_name.replace(/^v/, ""), r]));
  const notes = parseNotes(published[0].body);
  return {
    releases: notes.map((n, i) => {
      const rel = byVersion.get(n.version);
      const date = rel ? rel.published_at.slice(0, 10) : EARLIER_DATES[n.version] || null;
      return {
        version: n.version,
        date,
        dateLabel: formatDate(date),
        url: rel ? rel.html_url : null,
        anchor: anchor(n.version),
        latest: i === 0,
        highlights: n.highlights,
        html: n.html,
      };
    }),
  };
}

async function readChangelog() {
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "hexa-studio-landing" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(API, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`GitHub releases: ${res.status}`);
  return changelog(await res.json());
}

module.exports = { RELEASES, readChangelog, changelog, parseNotes, inline, formatDate, esc };
