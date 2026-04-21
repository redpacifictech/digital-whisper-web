(() => {
  "use strict";
  const container = document.getElementById("issues");

  // Blocks javascript:, data:, and other script-executing schemes on href.
  function safeHref(url) {
    return typeof url === "string" && /^https?:\/\//i.test(url) ? url : null;
  }

  fetch("articles.json").then(r => r.json()).then(render).catch(err => {
    console.error(err);
    container.textContent = "שגיאה בטעינת הנתונים.";
  });

  function render(articles) {
    const byIssue = new Map();
    for (const a of articles) {
      if (!byIssue.has(a.issue)) byIssue.set(a.issue, []);
      byIssue.get(a.issue).push(a);
    }
    const issues = [...byIssue.entries()]
      .map(([issue, arts]) => ({
        issue,
        date: arts[0].date,
        label: String(issue).padStart(3, "0"),
        count: arts.length,
        articles: arts.slice().sort((x, y) => x.id.localeCompare(y.id)),
      }))
      .sort((a, b) => b.issue - a.issue);

    const openFromHash = new Set(
      (new URLSearchParams(location.hash.replace(/^#/, "")).get("open") || "")
        .split(",").filter(Boolean).map(Number)
    );

    const frag = document.createDocumentFragment();
    for (const issue of issues) {
      const det = document.createElement("details");
      det.className = "issue";
      det.dataset.issue = issue.issue;
      if (openFromHash.has(issue.issue)) det.open = true;

      const summary = document.createElement("summary");
      const noEl = document.createElement("span");
      noEl.className = "issue-no";
      noEl.textContent = issue.label;
      const dtEl = document.createElement("span");
      dtEl.className = "issue-date";
      dtEl.textContent = issue.date;
      const cntEl = document.createElement("span");
      cntEl.className = "issue-count";
      cntEl.textContent = `${issue.count} מאמרים`;
      summary.appendChild(noEl);
      summary.appendChild(dtEl);
      summary.appendChild(cntEl);
      det.appendChild(summary);

      const list = document.createElement("div");
      list.className = "issue-articles";
      for (const a of issue.articles) {
        const wrap = document.createElement("div");

        const title = document.createElement("a");
        title.className = "issue-article-title article-title";
        const href = safeHref(a.pdf || a.url);
        if (href) {
          title.href = href;
          title.target = "_blank";
          title.rel = "noopener noreferrer";
        }
        title.textContent = a.title;
        wrap.appendChild(title);

        const meta = document.createElement("div");
        meta.className = "issue-article-meta";
        meta.textContent = a.authors.join("  ·  ");
        wrap.appendChild(meta);

        if (a.tags?.length) {
          const tags = document.createElement("div");
          tags.className = "issue-article-tags";
          tags.textContent = a.tags.join("  ·  ");
          wrap.appendChild(tags);
        }

        list.appendChild(wrap);
      }
      det.appendChild(list);
      det.addEventListener("toggle", syncHash);
      frag.appendChild(det);
    }
    container.appendChild(frag);
  }

  function syncHash() {
    const open = [...container.querySelectorAll("details.issue[open]")]
      .map(d => parseInt(d.dataset.issue, 10))
      .filter(Number.isFinite);
    const h = open.length ? "#open=" + open.join(",") : "";
    if (h !== location.hash) history.replaceState(null, "", location.pathname + h);
  }
})();
