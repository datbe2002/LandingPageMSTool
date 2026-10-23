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

// What page.html is written with, for a config saved before billing existed.
const BUILT_IN_BILLING = { annual: true, annualDiscount: 20, defaultPeriod: "annually" };

const PRICE = /^\d{1,5}(\.\d{1,2})?$/;
const money = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

/** A monthly price billed annually, `discount` percent off: per month and per year (shared/site.ts does the same sum). */
function annualPrice(monthly, discount) {
  const year = Math.round(Number(monthly) * 12 * (100 - discount)) / 100;
  return { perMonth: money(Math.round((year / 12) * 100) / 100), perYear: money(year) };
}

/** The billing the config asks for, or null when it's missing or makes no sense. */
function readBilling(b) {
  if (!b || typeof b !== "object") return null;
  const d = b.annualDiscount;
  if (!Number.isInteger(d) || d < 0 || d > 90) return null;
  return { annual: b.annual === true, annualDiscount: d, defaultPeriod: b.annual === true && b.defaultPeriod === "monthly" ? "monthly" : "annually" };
}

/**
 * A price, its "Billed …" line and the comparison table's short form. A paid plan billed
 * annually gets both prices (class pm / pa); the section's Monthly / Annually switch shows one.
 */
function priceParts(price, period, billing) {
  const per = `<span class="per">/ ${esc(period)}</span>`;
  const monthly = `<b><sup>$</sup>${esc(price)}</b>${per}`;
  if (Number(price) === 0) return { price: monthly, billed: billing.annual ? '<p class="billed" aria-hidden="true"></p>' : "", short: `$${esc(price)}` };
  if (!billing.annual) return { price: monthly, billed: "", short: `$${esc(price)} / ${esc(period)}` };
  const a = annualPrice(price, billing.annualDiscount);
  return {
    price: `<span class="pm">${monthly}</span><span class="pa"><b><sup>$</sup>${a.perMonth}</b>${per}</span>`,
    billed: `<p class="billed"><span class="pm">Billed monthly</span><span class="pa">$${a.perYear} billed yearly</span></p>`,
    short: `<span class="pm">$${esc(price)} / ${esc(period)}</span><span class="pa">$${a.perMonth} / ${esc(period)}</span>`,
  };
}

function renderPlan(html, name, plan, checkIcon, billing) {
  if (!plan || typeof plan !== "object") return html;
  html = fill(html, `pricing.${name}.tagline`, () => (str(plan.tagline) !== null ? esc(plan.tagline) : null));
  const price = str(plan.price);
  const period = str(plan.period);
  if (price !== null && period !== null && PRICE.test(price.trim())) {
    const parts = priceParts(price.trim(), period, billing);
    html = fill(html, `pricing.${name}.price`, () => parts.price);
    html = fill(html, `pricing.${name}.billed`, () => parts.billed);
    // The comparison table's header: "$0" for a free plan, "$9.99 / month" otherwise.
    html = fill(html, `pricing.${name}.short`, () => parts.short);
  } else if (name === "enterprise" && str(plan.priceLabel) && !(price || "").trim()) {
    // No price: a quote ("Custom").
    html = fill(html, `pricing.${name}.price`, () => `<b class="quote">${esc(plan.priceLabel)}</b>`);
    html = fill(html, `pricing.${name}.billed`, () => (billing.annual ? '<p class="billed" aria-hidden="true"></p>' : ""));
    html = fill(html, `pricing.${name}.short`, () => esc(plan.priceLabel));
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
  const billing = readBilling(pricing.billing) || BUILT_IN_BILLING;
  // Without annual billing there is no switch and only the monthly prices show.
  html = fill(html, "pricing.billing.default", () => (billing.annual ? billing.defaultPeriod : "monthly"));
  html = fill(html, "pricing.billing.switch", (inner) =>
    !billing.annual
      ? ""
      : inner
          .replace(/ <span class="save">[^<]*<\/span>/, billing.annualDiscount > 0 ? ` <span class="save">Save ${billing.annualDiscount}%</span>` : "")
          .replace(/(data-period="(monthly|annually)" aria-pressed=")(true|false)/g, (w, start, period) => start + String(period === billing.defaultPeriod)),
  );
  html = renderPlan(html, "free", pricing.free, checkIcon, billing);
  html = renderPlan(html, "pro", pricing.pro, checkIcon, billing);
  const ent = pricing.enterprise;
  if (ent && typeof ent === "object") {
    if (ent.enabled === false) html = html.replace(/(data-cms-plan="enterprise")/g, "$1 hidden");
    html = renderPlan(html, "enterprise", ent, checkIcon, billing);
    html = fill(html, "pricing.enterprise.badge", () => (str(ent.badge) === null ? null : ent.badge.trim() ? ` <span class="badge">${esc(ent.badge)}</span>` : ""));
    html = fill(html, "pricing.enterprise.ctaLabel", () => (str(ent.ctaLabel) ? esc(ent.ctaLabel) : null));
    html = fill(html, "pricing.enterprise.ctaUrl", () => (safeUrl(ent.ctaUrl) ? esc(safeUrl(ent.ctaUrl)) : null));
    html = fill(html, "pricing.enterprise.note", () => (str(ent.note) === null ? null : ent.note.trim() ? `<p class="note">${inline(ent.note.trim())}</p>` : ""));
  }
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
