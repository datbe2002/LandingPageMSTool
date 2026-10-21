// Fills page.html with the content set in the admin dashboard (hexa-license-admin,
// shared/site.ts has the shape). page.html marks each editable spot as
//   <!--cms:key-->built-in content<!--/cms:key-->
// and each section that can be hidden with data-cms-section / data-cms-nav. A field the
// config doesn't have keeps the built-in content, so a missing or broken config can
// only ever leave the page as it is in page.html.

// The address and profile page.html is written with; the config's contact replaces them everywhere.
const BUILT_IN_EMAIL = "founder@hexastudio.com.vn";
const BUILT_IN_LINKEDIN = "https://www.linkedin.com/in/truongtandat";

const esc = (text) =>
  String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** https:, mailto: and #anchors only — the same rule the dashboard and the Worker apply. */
function safeUrl(url) {
  const u = String(url || "").trim();
  if (/^#[A-Za-z][\w-]*$/.test(u)) return u;
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+/.test(u)) return u;
  if (/^https:\/\/[^\s]+$/.test(u)) return u;
  return null;
}

/** Text with **bold** and [text](url) links; everything else is escaped. */
function inline(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/\[([^\]]*)\]\(([^)\s]*)\)/g, (whole, label, url) => {
      // esc() has already turned & into &amp; inside the url; undo it to check, redo it to write.
      const safe = safeUrl(url.replace(/&amp;/g, "&"));
      return safe ? `<a href="${esc(safe)}">${label}</a>` : label;
    });
}

const str = (v) => (typeof v === "string" ? v : null);

/** Replaces every <!--cms:key-->…<!--/cms:key--> with fill(inner); fill returning null keeps the inner part. */
function fill(html, key, fn) {
  const re = new RegExp(`<!--cms:${key.replace(/\./g, "\\.")}-->([\\s\\S]*?)<!--/cms:${key.replace(/\./g, "\\.")}-->`, "g");
  return html.replace(re, (whole, inner) => {
    const out = fn(inner);
    return out === null || out === undefined ? inner : out;
  });
}

/** Drops the markers that are left, keeping what they wrap. */
const unmark = (html) => html.replace(/<!--\/?cms:[\w.]+-->/g, "");

function renderPlan(html, name, plan, checkIcon) {
  if (!plan || typeof plan !== "object") return html;
  html = fill(html, `pricing.${name}.tagline`, () => (str(plan.tagline) !== null ? esc(plan.tagline) : null));
  const price = str(plan.price);
  const period = str(plan.period);
  if (price !== null && period !== null) {
    html = fill(html, `pricing.${name}.price`, () => `<b><sup>$</sup>${esc(price)}</b><span>/ ${esc(period)}</span>`);
    // The comparison table's header: "$0" for a free plan, "$9.99 / month" otherwise.
    html = fill(html, `pricing.${name}.short`, () => (Number(price) === 0 ? `$${esc(price)}` : `$${esc(price)} / ${esc(period)}`));
  }
  html = fill(html, `pricing.${name}.terms`, () => (str(plan.terms) === null ? null : plan.terms.trim() ? `<p class="terms">${esc(plan.terms)}</p>` : ""));
  if (Array.isArray(plan.features) && checkIcon) {
    const lines = plan.features.map(str).filter((l) => l && l.trim());
    if (lines.length) {
      html = fill(html, `pricing.${name}.features`, () => lines.map((l) => `\n              <li>${checkIcon}<span>${inline(l.trim())}</span></li>`).join(""));
    }
  }
  return html;
}

function announcement(a) {
  if (!a || a.enabled !== true || !str(a.text) || !a.text.trim()) return "";
  const url = safeUrl(a.linkUrl);
  const button = url && str(a.linkLabel) && a.linkLabel.trim() ? `<a class="announce-btn" href="${esc(url)}">${esc(a.linkLabel)}</a>` : "";
  // The script keeps the fixed menu just under the strip until the strip has scrolled away.
  return (
    `
  <div class="announce" id="announce" role="region" aria-label="Announcement"><span>${inline(a.text.trim())}</span>${button}</div>\n` +
    `  <script>(function(){var a=document.getElementById("announce"),r=document.documentElement;function f(){r.style.setProperty("--ann",Math.max(0,a.offsetHeight-window.scrollY)+"px")}f();addEventListener("scroll",f,{passive:true});addEventListener("resize",f)})();</script>`
  );
}

/**
 * page.html with `config` applied. `config` null (nothing published, or the admin can't be
 * reached) gives page.html as it is. `preview` labels the page as a draft and keeps it out of search.
 */
function render(template, config, { preview = false } = {}) {
  let html = template;
  if (!config || typeof config !== "object") return unmark(html);

  // Sections switched off: hidden, not removed (the page's script still looks for their elements).
  const sections = config.sections && typeof config.sections === "object" ? config.sections : {};
  for (const [id, on] of Object.entries(sections)) {
    if (on !== false || !/^[a-z]+$/.test(id)) continue;
    html = html.replace(new RegExp(`(data-cms-(?:section|nav)="${id}")`, "g"), "$1 hidden");
  }

  const seo = config.seo || {};
  if (str(seo.title)) html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(seo.title)}</title>`);
  if (str(seo.description)) html = html.replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${esc(seo.description)}"`);
  if (str(seo.ogTitle)) html = html.replace(/<meta property="og:title" content="[^"]*"/, `<meta property="og:title" content="${esc(seo.ogTitle)}"`);
  if (str(seo.ogDescription)) html = html.replace(/<meta property="og:description" content="[^"]*"/, `<meta property="og:description" content="${esc(seo.ogDescription)}"`);

  html = fill(html, "announcement", () => announcement(config.announcement));

  const hero = config.hero || {};
  html = fill(html, "hero.eyebrow", () => (str(hero.eyebrow) === null ? null : hero.eyebrow.trim() ? `<p class="eyebrow mono" data-hero-in>${esc(hero.eyebrow)}</p>` : ""));
  html = fill(html, "hero.title", () =>
    str(hero.title) ? esc(hero.title) + (str(hero.titleDim) && hero.titleDim.trim() ? ` <span class="dim">${esc(hero.titleDim)}</span>` : "") : null,
  );
  html = fill(html, "hero.lead", () => (str(hero.lead) ? esc(hero.lead) : null));
  html = fill(html, "hero.ctaLabel", () => (str(hero.ctaLabel) ? esc(hero.ctaLabel) : null));

  const pricing = config.pricing || {};
  // The tick every feature line starts with, taken from page.html itself.
  const checkIcon = (/<!--cms:pricing\.free\.features-->[\s\S]*?<li>(<svg[\s\S]*?<\/svg>)/.exec(html) || [])[1];
  html = fill(html, "pricing.heading", () => (str(pricing.heading) ? esc(pricing.heading) : null));
  html = fill(html, "pricing.sub", () => (str(pricing.sub) === null ? null : pricing.sub.trim() ? `<p class="sub" data-rise>${esc(pricing.sub)}</p>` : ""));
  html = renderPlan(html, "free", pricing.free, checkIcon);
  html = renderPlan(html, "pro", pricing.pro, checkIcon);
  const pro = pricing.pro || {};
  html = fill(html, "pricing.pro.badge", () => (str(pro.badge) === null ? null : pro.badge.trim() ? ` <span class="badge">${esc(pro.badge)}</span>` : ""));
  html = fill(html, "pricing.pro.ctaLabel", () => (str(pro.ctaLabel) ? esc(pro.ctaLabel) : null));
  html = fill(html, "pricing.pro.ctaUrl", () => (safeUrl(pro.ctaUrl) ? esc(safeUrl(pro.ctaUrl)) : null));
  html = fill(html, "pricing.pro.note", () => (str(pro.note) === null ? null : pro.note.trim() ? `<p class="note">${inline(pro.note.trim())}</p>` : ""));

  html = unmark(html);

  // Contact last, so it also reaches the Get Pro link and note when they still use the built-in address.
  const contact = config.contact || {};
  if (str(contact.email) && /^[^\s@"<>]+@[^\s@"<>]+\.[^\s@"<>]+$/.test(contact.email.trim())) html = html.split(BUILT_IN_EMAIL).join(esc(contact.email.trim()));
  if (str(contact.linkedin) !== null) {
    const li = safeUrl(contact.linkedin);
    if (li) html = html.split(BUILT_IN_LINKEDIN).join(esc(li));
  }

  if (preview) {
    html = html.replace("<head>", '<head>\n  <meta name="robots" content="noindex" />');
    html = html.replace("</body>", '  <div class="preview-bar" role="status">Draft preview: visitors don\'t see this yet</div>\n</body>');
  }
  return html;
}

module.exports = { render, unmark, inline, safeUrl };
