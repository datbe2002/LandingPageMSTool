// node --test   (checks api/_lib/render.js against the real page.html)
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { render, inline, safeUrl } = require("../api/_lib/render");

const page = readFileSync(join(__dirname, "..", "page.html"), "utf8");

test("no config: the page as written, without markers", () => {
  const html = render(page, null);
  assert.ok(!html.includes("<!--cms:"));
  assert.ok(html.includes("Read, fix and ship every flow"));
  assert.ok(!html.includes('class="announce"'));
});

test("applies the hero, the announcement and the pricing", () => {
  const html = render(page, {
    announcement: { enabled: true, text: "Pro is **30% off** until [October 31](#pricing).", linkLabel: "See pricing", linkUrl: "#pricing" },
    hero: { eyebrow: "", title: "Ship flows faster", titleDim: "", lead: "New lead.", ctaLabel: "Get it free" },
    pricing: {
      heading: "Simple pricing",
      sub: "",
      free: { tagline: "Free tag", price: "0", period: "forever", terms: "", features: ["**One**", "Two"] },
      pro: { tagline: "Pro tag", price: "12", period: "year", terms: "Per seat", features: ["**Three**"], badge: "", ctaLabel: "Buy", ctaUrl: "https://buy.example/pro", note: "" },
    },
  });
  assert.match(html, /<div class="announce"[^>]*><span>Pro is <b>30% off<\/b> until <a href="#pricing">October 31<\/a>\.<\/span><a class="announce-btn" href="#pricing">See pricing<\/a><\/div>/);
  assert.ok(!html.includes('class="eyebrow'));
  assert.ok(html.includes('<h1 id="hero-title" data-split>Ship flows faster</h1>'));
  assert.equal(html.split("Get it free").length - 1, 4);
  assert.ok(!html.includes("Download for Windows"));
  assert.ok(html.includes("<b><sup>$</sup>12</b><span>/ year</span>"));
  assert.ok(html.includes("<small>$12 / year</small>"));
  assert.ok(html.includes('href="https://buy.example/pro"'));
  assert.ok(!html.includes('<p class="note">'));
  assert.ok(!html.includes('class="badge"'));
  assert.ok(html.includes("<span><b>Three</b></span>"));
  assert.ok(!html.includes("<b>Edit flows</b>"));
});

test("hides switched-off sections and their links, keeping the elements", () => {
  const html = render(page, { sections: { runs: false, pricing: true } });
  assert.match(html, /<section data-cms-section="runs" hidden /);
  assert.match(html, /<a href="#runs" data-cms-nav="runs" hidden>/);
  assert.ok(html.includes('id="run-bars"'), "the section's elements stay for the page's script");
  assert.ok(!/data-cms-section="pricing" hidden/.test(html));
});

test("replaces the contact everywhere and the head tags", () => {
  const html = render(page, {
    contact: { email: "hello@hexa.example", linkedin: "https://www.linkedin.com/company/hexa" },
    seo: { title: "New title", description: "New description", ogTitle: "OG", ogDescription: "OG desc" },
  });
  assert.ok(!html.includes("founder@hexastudio.com.vn"));
  assert.ok(html.includes("mailto:hello@hexa.example"));
  assert.ok(!html.includes("linkedin.com/in/truongtandat"));
  assert.ok(html.includes("<title>New title</title>"));
  assert.ok(html.includes('<meta property="og:description" content="OG desc"'));
});

test("escapes text and drops links that aren't https, mailto or #", () => {
  const html = render(page, {
    hero: { title: '<script>alert(1)</script>', lead: 'a "quote" & more', ctaLabel: "x" },
    pricing: { pro: { ctaUrl: "javascript:alert(1)", note: "[click](javascript:void0) or [ok](https://ok.example)" } },
  });
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(!html.includes("javascript:"));
  assert.ok(html.includes('<p class="note">click or <a href="https://ok.example">ok</a></p>'));
  assert.equal(safeUrl("http://plain.example"), null);
  assert.equal(inline("**a** <b>"), "<b>a</b> &lt;b&gt;");
});

test("marks a preview and keeps it out of search", () => {
  const html = render(page, { hero: { title: "Draft" } }, { preview: true });
  assert.ok(html.includes('<meta name="robots" content="noindex" />'));
  assert.ok(html.includes('class="preview-bar"'));
});
