// node --test   (checks api/_lib/releases.js and the /changelog page it fills)
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { changelog, parseNotes, inline, formatDate } = require("../api/_lib/releases");
const { render } = require("../api/changelog");

// The shape of .github/release-notes.md in the app repo: every version, then Download and Requirements.
const BODY = `### What's new in 0.12.0
**Hexa Studio Pro**
- A license key can now be **revoked**.
- If the license server can't be reached, your key keeps working.

### What's new in 0.10.0
**Connection references** (Power Automate › Connections) — every connection reference in the environment.
- Spot the ones that are **unused**.

**Flows**
- Fixed: the **+** at the end of a flow was off centre.

**Sign-in**
- Pick the **browser** to sign in with.

### What's new in 0.3.0
- **FetchXML Builder** — a new tool in the sidebar:
  - Write FetchXML with \`autocomplete\`.
  - Open *system and personal views*.
- An expired sign-in now asks once to sign in again.

### Download
Download **\`Hexa.Studio_*_x64-setup.exe\`** below.

### Requirements
- Windows 10/11 (64-bit).`;

const rel = (tag, published_at, body = "") => ({ tag_name: tag, published_at, html_url: `https://github.com/x/y/releases/tag/${tag}`, draft: false, prerelease: false, body });

test("one entry per version, newest first, without Download or Requirements", () => {
  const notes = parseNotes(BODY);
  assert.deepEqual(notes.map((n) => n.version), ["0.12.0", "0.10.0", "0.3.0"]);
  assert.ok(!notes.some((n) => n.html.includes("setup.exe") || n.html.includes("Windows 10")));
});

test("groups become headings, the place goes in the heading, lists nest", () => {
  const [, v10, v3] = parseNotes(BODY);
  assert.ok(v10.html.includes("<h3>Connection references <small>(Power Automate › Connections)</small></h3>"));
  assert.ok(v10.html.includes("<p>Every connection reference in the environment.</p>"));
  assert.ok(v3.html.includes("<li><strong>FetchXML Builder</strong> — a new tool in the sidebar:<ul><li>Write FetchXML with <code>autocomplete</code>.</li>"));
  assert.ok(v3.html.includes("<em>system and personal views</em>"));
  assert.equal((v3.html.match(/<ul>/g) || []).length, 2);
  assert.equal((v3.html.match(/<\/ul>/g) || []).length, 2);
});

test("highlights: the groups and what each says, else the first items (their bold name when they start with one)", () => {
  const [v12, v10, v3] = parseNotes(BODY);
  assert.deepEqual(v10.highlights, [
    { title: "Connection references", text: "Every connection reference in the environment." },
    { title: "Flows", text: "Fixed: the + at the end of a flow was off centre." },
    { title: "Sign-in", text: "Pick the browser to sign in with." },
  ]);
  assert.deepEqual(v12.highlights, [
    { title: "", text: "A license key can now be revoked." },
    { title: "", text: "If the license server can't be reached, your key keeps working." },
  ]);
  assert.deepEqual(v3.highlights, [
    { title: "FetchXML Builder", text: "A new tool in the sidebar" },
    { title: "", text: "An expired sign-in now asks once to sign in again." },
  ]);
  const long = parseNotes(`### What's new in 1.0.0\n- ${"word ".repeat(40)}`)[0].highlights[0].text;
  assert.ok(long.length <= 111 && long.endsWith("…"));
});

test("inline: escapes HTML and keeps only https links", () => {
  assert.equal(inline("<b>x</b> & **y**"), "&lt;b&gt;x&lt;/b&gt; &amp; <strong>y</strong>");
  assert.equal(inline("[ok](https://a.b/c?d=1&e=2) [no](javascript:alert) [no2](http://a.b)"), '<a href="https://a.b/c?d=1&amp;e=2">ok</a> no no2');
  assert.equal(inline("`**not bold**`"), "<code>**not bold**</code>");
});

test("dates come from the releases, or from the versions before the releases repo", () => {
  const { releases } = changelog([rel("v0.10.0", "2026-10-17T06:00:20Z"), rel("v0.12.0", "2026-10-21T04:45:28Z", BODY), rel("v0.13.0-beta", "2026-10-22T00:00:00Z", "")].map((r, i) => (i === 2 ? { ...r, prerelease: true } : r)));
  assert.deepEqual(
    releases.map((r) => [r.version, r.dateLabel, r.latest, !!r.url, r.anchor]),
    [
      ["0.12.0", "21 Oct 2026", true, true, "v0-12-0"],
      ["0.10.0", "17 Oct 2026", false, true, "v0-10-0"],
      ["0.3.0", "24 Sep 2026", false, false, "v0-3-0"],
    ],
  );
  assert.equal(formatDate("2026-09-03"), "3 Sep 2026");
  assert.throws(() => changelog([]));
});

test("the page: a section and a table-of-contents link per version; a message when GitHub is down", () => {
  const html = render(changelog([rel("v0.12.0", "2026-10-21T04:45:28Z", BODY)]));
  assert.ok(!html.includes("<!--"));
  assert.equal((html.match(/<section class="rel"/g) || []).length, 3);
  assert.ok(html.includes('<a href="#v0-3-0"><span>0.3.0</span><small>24 Sep 2026</small></a>'));
  assert.ok(html.includes("Latest: 0.12.0, 21 Oct 2026"));
  const down = render(null);
  assert.ok(down.includes("can't be loaded right now") && !down.includes("<!--"));
});
