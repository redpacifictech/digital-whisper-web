(() => {
  "use strict";
  const root = document.getElementById("dash");

  Promise.all([
    fetch("articles.json").then(r => r.json()),
    fetch("tags.json").then(r => r.json()).catch(() => []),
  ]).then(([articles, tags]) => {
    root.innerHTML = "";
    render(articles, tags);
  }).catch(err => {
    console.error(err);
    root.innerHTML = `<div class="dash-card span-12"><div class="dash-card-head"><div class="dash-card-title">שגיאה בטעינת הנתונים</div></div></div>`;
  });

  const MONTH_HE = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];

  // Builds a same-origin URL with an encoded hash, matching the index-page
  // hash protocol in app.js (tags / from / to / q).
  function hashUrl(base, params) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") p.set(k, v);
    }
    const s = p.toString();
    return s ? `${base}#${s}` : base;
  }

  function render(articles, tags) {
    const issueSet = new Set();
    const authorCount = new Map();
    const byYear = new Map();
    const monthIssueSet = new Map();
    let coauthored = 0;

    for (const a of articles) {
      issueSet.add(a.issue);
      for (const au of a.authors || []) {
        authorCount.set(au, (authorCount.get(au) || 0) + 1);
      }
      const y = (a.date || "").slice(0, 4);
      const m = (a.date || "").slice(5, 7);
      if (y) byYear.set(y, (byYear.get(y) || 0) + 1);
      if (m) {
        if (!monthIssueSet.has(m)) monthIssueSet.set(m, new Set());
        monthIssueSet.get(m).add(a.issue);
      }
      if ((a.authors || []).length > 1) coauthored += 1;
    }

    const totalArticles = articles.length;
    const totalIssues = issueSet.size;
    const totalAuthors = authorCount.size;
    const coauthoredPct = Math.round((coauthored / totalArticles) * 100);

    const years = [...byYear.keys()].sort();
    const minYear = years[0] || "";
    const maxYear = years[years.length - 1] || "";
    const activeYears = years.length;
    const issuesPerYear = (totalIssues / Math.max(1, activeYears)).toFixed(1);

    const topTags = (tags.length ? tags : buildTagsFromArticles(articles))
      .slice()
      .sort((x, y) => y.count - x.count)
      .slice(0, 15);

    const topAuthors = [...authorCount.entries()]
      .sort((x, y) => y[1] - x[1])
      .slice(0, 15);

    const frag = document.createDocumentFragment();

    // KPI row — 3 cards. Each links to the corresponding overview page.
    frag.appendChild(kpiCard(4, "מאמרים", totalArticles, `${minYear}–${maxYear}`,
      { href: "./", title: "עבור לאינדקס המאמרים" }));
    frag.appendChild(kpiCard(4, "גליונות", totalIssues, `≈ ${issuesPerYear} גליונות בשנה`,
      { href: "by-issue.html", title: "עבור לעמוד הגליונות" }));
    frag.appendChild(kpiCard(4, "מחברים", totalAuthors, `${coauthoredPct}% שיתופי פעולה`,
      { href: "by-author.html", title: "עבור לעמוד המחברים" }));

    // Articles per year — span 12. Click a column → filter index by that year.
    frag.appendChild(
      columnChart({
        span: 12,
        title: "מאמרים לפי שנה",
        sub: `${activeYears} שנות פעילות`,
        entries: years.map(y => ({ label: y.slice(2), value: byYear.get(y), fullLabel: y })),
        hrefFor: e => hashUrl("./", { from: e.fullLabel, to: e.fullLabel }),
        titleFor: e => `${e.fullLabel}: ${e.value} · סנן לשנה זו`,
      })
    );

    // Top tags — span 6. Click a row → filter index by that tag.
    frag.appendChild(
      barListCard({
        span: 6,
        title: "התגים הנפוצים",
        sub: `${topTags.length} תגים מובילים`,
        rows: topTags.map(t => ({
          label: t.tag,
          count: t.count,
          ratio: t.count / topTags[0].count,
          dir: "ltr",
        })),
        hrefFor: r => hashUrl("./", { tags: r.label }),
        titleFor: r => `תג ${r.label}: ${r.count} · סנן לפי תג זה`,
      })
    );

    // Top authors — span 6. Click a row → search index by author name.
    frag.appendChild(
      barListCard({
        span: 6,
        title: "הכותבים הפוריים",
        sub: `${topAuthors.length} כותבים מובילים`,
        rows: topAuthors.map(([name, c]) => ({
          label: name,
          count: c,
          ratio: c / topAuthors[0][1],
          dir: "auto",
        })),
        hrefFor: r => hashUrl("./", { q: r.label }),
        titleFor: r => `${r.label}: ${r.count} · חפש לפי מחבר זה`,
      })
    );

    // Publishing rhythm (issues by month) — span 12. Not clickable:
    // month-only filtering isn't a view we expose.
    const monthEntries = MONTH_HE.map((lbl, i) => {
      const key = String(i + 1).padStart(2, "0");
      const set = monthIssueSet.get(key);
      return { label: lbl, value: set ? set.size : 0, fullLabel: lbl };
    });
    frag.appendChild(
      columnChart({
        span: 12,
        title: "קצב הפרסום לפי חודש",
        sub: "גליונות ייחודיים",
        entries: monthEntries,
      })
    );

    root.appendChild(frag);
  }

  // ── Card builders ──────────────────────────────────────────────────────

  function card(span, title, sub) {
    const el = document.createElement("section");
    el.className = `dash-card span-${span}`;
    const head = document.createElement("div");
    head.className = "dash-card-head";
    const t = document.createElement("div");
    t.className = "dash-card-title";
    t.textContent = title;
    head.appendChild(t);
    if (sub) {
      const s = document.createElement("div");
      s.className = "dash-card-sub";
      s.textContent = sub;
      head.appendChild(s);
    }
    el.appendChild(head);
    return el;
  }

  function kpiCard(span, label, value, sub, link) {
    const el = link ? document.createElement("a") : document.createElement("section");
    el.className = `dash-card span-${span}` + (link ? " is-link" : "");
    if (link) {
      el.href = link.href;
      if (link.title) el.title = link.title;
    }
    const v = document.createElement("div");
    v.className = "kpi-value";
    v.textContent = typeof value === "number" ? value.toLocaleString("en-US") : value;
    el.appendChild(v);
    const l = document.createElement("div");
    l.className = "kpi-label";
    l.textContent = label;
    el.appendChild(l);
    if (sub) {
      const s = document.createElement("div");
      s.className = "dash-card-sub";
      s.style.marginTop = "10px";
      s.textContent = sub;
      el.appendChild(s);
    }
    return el;
  }

  function columnChart({ span, title, sub, entries, hrefFor, titleFor }) {
    const el = card(span, title, sub);
    const chart = document.createElement("div");
    chart.className = "col-chart";
    const max = Math.max(...entries.map(e => e.value), 1);
    for (const e of entries) {
      const href = hrefFor ? hrefFor(e) : null;
      const col = href ? document.createElement("a") : document.createElement("div");
      col.className = "col" + (href ? " is-link" : "");
      col.title = titleFor ? titleFor(e) : `${e.fullLabel || e.label}: ${e.value}`;
      if (href) col.href = href;

      const val = document.createElement("div");
      val.className = "col-value";
      val.textContent = e.value;
      col.appendChild(val);

      const bar = document.createElement("div");
      bar.className = "col-bar";
      bar.style.setProperty("--col-h", Math.max(2, Math.round((e.value / max) * 100)) + "%");
      col.appendChild(bar);

      const label = document.createElement("div");
      label.className = "col-label";
      label.textContent = e.label;
      col.appendChild(label);

      chart.appendChild(col);
    }
    el.appendChild(chart);
    return el;
  }

  function barListCard({ span, title, sub, rows, hrefFor, titleFor }) {
    const el = card(span, title, sub);
    const list = document.createElement("div");
    list.className = "bar-list";
    for (const r of rows) {
      const href = hrefFor ? hrefFor(r) : null;
      const row = href ? document.createElement("a") : document.createElement("div");
      row.className = "bar-row" + (href ? " is-link" : "");
      if (href) {
        row.href = href;
        if (titleFor) row.title = titleFor(r);
      }

      const track = document.createElement("div");
      track.className = "bar-track";
      const fill = document.createElement("div");
      fill.className = "bar-fill";
      fill.style.setProperty("--bar-w", Math.max(4, Math.round(r.ratio * 100)) + "%");
      track.appendChild(fill);
      row.appendChild(track);

      const label = document.createElement("span");
      label.className = "bar-label";
      if (r.dir) label.setAttribute("dir", r.dir);
      label.textContent = r.label;
      row.appendChild(label);

      const count = document.createElement("span");
      count.className = "bar-count";
      count.textContent = r.count;
      row.appendChild(count);

      list.appendChild(row);
    }
    el.appendChild(list);
    return el;
  }

  function buildTagsFromArticles(articles) {
    const m = new Map();
    for (const a of articles) for (const t of a.tags || []) m.set(t, (m.get(t) || 0) + 1);
    return [...m.entries()].map(([tag, count]) => ({ tag, count }));
  }
})();
