(() => {
  "use strict";
  const container = document.getElementById("authors");
  const search = document.getElementById("author-q");
  let allRows = [];

  fetch("articles.json").then(r => r.json()).then(render).catch(err => {
    console.error(err);
    container.textContent = "שגיאה בטעינת הנתונים.";
  });

  function render(articles) {
    const counts = new Map();
    for (const a of articles) {
      for (const author of a.authors) {
        const key = author.trim();
        if (!key) continue;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    const rows = [...counts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "he")
    );

    container.textContent = "";
    const frag = document.createDocumentFragment();
    for (const [author, count] of rows) {
      const link = document.createElement("a");
      link.className = "author-row";
      link.href = `./#q=${encodeURIComponent(author)}`;
      link.dataset.q = author.toLowerCase();

      const name = document.createElement("span");
      name.className = "author-name";
      name.textContent = author;

      const badge = document.createElement("span");
      badge.className = "author-count";
      badge.textContent = count;

      link.appendChild(name);
      link.appendChild(badge);
      frag.appendChild(link);
    }
    container.appendChild(frag);
    allRows = [...container.children];

    search.addEventListener("input", filter);
    document.addEventListener("keydown", ev => {
      if (ev.key === "/" && document.activeElement !== search) {
        ev.preventDefault();
        search.focus();
      }
    });
  }

  function filter() {
    const q = search.value.trim().toLowerCase();
    for (const row of allRows) {
      row.style.display = !q || row.dataset.q.includes(q) ? "" : "none";
    }
  }
})();
