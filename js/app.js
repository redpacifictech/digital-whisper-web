/* Digital Whisper Index — main app.
 * Single state object, rendered-from-state pattern, URL-hash persistence. */

(() => {
  "use strict";

  const els = {
    q: document.getElementById("q"),
    yearFrom: document.getElementById("year-from"),
    yearTo: document.getElementById("year-to"),
    yearsClear: document.getElementById("years-clear"),
    tagList: document.getElementById("tag-list"),
    tagsClear: document.getElementById("tags-clear"),
    articles: document.getElementById("articles"),
    empty: document.getElementById("empty"),
    resetAll: document.getElementById("reset-all"),
    statusCount: document.getElementById("status-count"),
    statusActive: document.getElementById("status-active"),
    sidebarToggle: document.getElementById("sidebar-toggle"),
    sidebarBody: document.getElementById("sidebar-body"),
    sidebarToggleCount: document.getElementById("sidebar-toggle-count"),
  };

  const state = {
    articles: [],
    tagsMeta: new Map(),
    maxTagCount: 1,
    allYears: [],
    selectedTags: new Set(),
    yearFrom: null,
    yearTo: null,
    query: "",
    pageSize: 40,
    shownCount: 40,
  };

  init().catch(err => {
    console.error(err);
    els.articles.textContent = "שגיאה בטעינת הנתונים. נסה לרענן.";
  });

  async function init() {
    const [arts, tags] = await Promise.all([
      fetch("articles.json").then(r => r.json()),
      fetch("tags.json").then(r => r.json()),
    ]);
    state.articles = arts;
    tags.forEach(t => state.tagsMeta.set(t.tag, { count: t.count, description: t.description }));
    state.maxTagCount = Math.max(1, ...tags.map(t => t.count));
    state.allYears = [...new Set(arts.map(a => a.date.slice(0, 4)))].sort();

    populateYearDropdowns();
    renderTagList(tags);
    wireUpEvents();
    readHash();
    render();
  }

  // ── Year dropdowns ──────────────────────────────────────────────────────
  function populateYearDropdowns() {
    const addOpts = (sel, placeholder) => {
      sel.textContent = "";
      const blank = document.createElement("option");
      blank.value = "";
      blank.textContent = placeholder;
      sel.appendChild(blank);
      for (const y of state.allYears) {
        const o = document.createElement("option");
        o.value = y; o.textContent = y;
        sel.appendChild(o);
      }
    };
    addOpts(els.yearFrom, "משנת —");
    addOpts(els.yearTo, "עד שנת —");
  }

  // ── Tag sidebar ─────────────────────────────────────────────────────────
  function renderTagList(tags) {
    els.tagList.textContent = "";
    const frag = document.createDocumentFragment();
    for (const t of tags) {
      const row = document.createElement("div");
      row.className = "tag-row";
      row.dataset.tag = t.tag;
      if (t.description) row.title = t.description;
      // Bar width scales with log to keep small tags visible.
      const pct = Math.max(
        4,
        Math.round((Math.log(t.count + 1) / Math.log(state.maxTagCount + 1)) * 100)
      );
      row.style.setProperty("--bar-width", pct + "%");

      const name = document.createElement("span");
      name.className = "tag-name";
      name.textContent = t.tag;

      const count = document.createElement("span");
      count.className = "tag-count";
      count.textContent = t.count;

      row.appendChild(name);
      row.appendChild(count);
      frag.appendChild(row);
    }
    els.tagList.appendChild(frag);
  }

  function refreshTagListSelection() {
    for (const row of els.tagList.querySelectorAll(".tag-row")) {
      row.classList.toggle("selected", state.selectedTags.has(row.dataset.tag));
    }
  }

  // ── Events ──────────────────────────────────────────────────────────────
  function wireUpEvents() {
    els.q.addEventListener("input", debounce(() => {
      state.query = els.q.value.trim().toLowerCase();
      state.shownCount = state.pageSize;
      render();
      writeHash();
    }, 120));

    els.yearFrom.addEventListener("change", () => {
      state.yearFrom = els.yearFrom.value || null;
      render(); writeHash();
    });
    els.yearTo.addEventListener("change", () => {
      state.yearTo = els.yearTo.value || null;
      render(); writeHash();
    });
    els.yearsClear.addEventListener("click", () => {
      state.yearFrom = state.yearTo = null;
      els.yearFrom.value = ""; els.yearTo.value = "";
      render(); writeHash();
    });

    els.tagList.addEventListener("click", (ev) => {
      const row = ev.target.closest(".tag-row");
      if (row) toggleTag(row.dataset.tag);
    });
    els.tagsClear.addEventListener("click", () => {
      state.selectedTags.clear();
      refreshTagListSelection();
      render();
      writeHash();
    });

    els.resetAll.addEventListener("click", resetAll);

    els.statusActive.addEventListener("click", (ev) => {
      const rm = ev.target.closest(".remove");
      if (!rm) return;
      const chip = rm.closest(".active-chip");
      if (!chip) return;
      if (chip.dataset.type === "tag") toggleTag(chip.dataset.value);
      else if (chip.dataset.type === "year") {
        state.yearFrom = state.yearTo = null;
        els.yearFrom.value = ""; els.yearTo.value = "";
        render(); writeHash();
      } else if (chip.dataset.type === "q") {
        state.query = ""; els.q.value = "";
        render(); writeHash();
      }
    });

    els.articles.addEventListener("click", (ev) => {
      const pill = ev.target.closest(".pill");
      if (pill) {
        ev.preventDefault();
        toggleTag(pill.dataset.tag);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const authorBtn = ev.target.closest(".author-link");
      if (authorBtn) {
        ev.preventDefault();
        setQuery(authorBtn.dataset.author);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });

    window.addEventListener("scroll", () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
        const total = currentFiltered().length;
        if (state.shownCount < total) {
          state.shownCount = Math.min(total, state.shownCount + state.pageSize);
          render();
        }
      }
    }, { passive: true });

    window.addEventListener("hashchange", () => {
      readHash();
      render();
    });

    if (els.sidebarToggle && els.sidebarBody) {
      els.sidebarToggle.addEventListener("click", () => {
        const open = els.sidebarToggle.getAttribute("aria-expanded") === "true";
        els.sidebarToggle.setAttribute("aria-expanded", open ? "false" : "true");
        els.sidebarBody.classList.toggle("open", !open);
      });
    }
  }

  function updateFilterCount() {
    if (!els.sidebarToggleCount) return;
    const n = state.selectedTags.size
      + (state.yearFrom || state.yearTo ? 1 : 0)
      + (state.query ? 1 : 0);
    els.sidebarToggleCount.textContent = n > 0 ? n.toLocaleString("he-IL") : "";
  }

  function toggleTag(tag) {
    if (state.selectedTags.has(tag)) state.selectedTags.delete(tag);
    else state.selectedTags.add(tag);
    state.shownCount = state.pageSize;
    refreshTagListSelection();
    render();
    writeHash();
  }

  function setQuery(q) {
    const trimmed = q.trim();
    // Toggle: click the same author again to clear the filter.
    state.query = state.query === trimmed.toLowerCase() ? "" : trimmed.toLowerCase();
    els.q.value = state.query ? trimmed : "";
    state.shownCount = state.pageSize;
    render();
    writeHash();
  }

  function resetAll() {
    state.selectedTags.clear();
    state.yearFrom = state.yearTo = null;
    state.query = "";
    els.q.value = "";
    els.yearFrom.value = ""; els.yearTo.value = "";
    state.shownCount = state.pageSize;
    refreshTagListSelection();
    render();
    writeHash();
  }

  // ── URL hash ────────────────────────────────────────────────────────────
  function writeHash() {
    const p = new URLSearchParams();
    if (state.selectedTags.size) p.set("tags", [...state.selectedTags].join(","));
    if (state.yearFrom) p.set("from", state.yearFrom);
    if (state.yearTo) p.set("to", state.yearTo);
    if (state.query) p.set("q", state.query);
    const s = p.toString();
    const newHash = s ? "#" + s : "";
    if (newHash !== window.location.hash) {
      history.replaceState(null, "", window.location.pathname + newHash);
    }
  }

  function readHash() {
    const h = window.location.hash.replace(/^#/, "");
    if (!h) {
      state.selectedTags.clear();
      state.yearFrom = state.yearTo = null;
      state.query = "";
      els.q.value = "";
      els.yearFrom.value = ""; els.yearTo.value = "";
      refreshTagListSelection();
      return;
    }
    const p = new URLSearchParams(h);
    state.selectedTags = new Set((p.get("tags") || "").split(",").filter(Boolean));
    state.yearFrom = p.get("from") || null;
    state.yearTo = p.get("to") || null;
    state.query = p.get("q") || "";
    els.q.value = state.query;
    els.yearFrom.value = state.yearFrom || "";
    els.yearTo.value = state.yearTo || "";
    refreshTagListSelection();
  }

  // ── Filtering (memoized) ────────────────────────────────────────────────
  let filterCache = null;
  let filterKey = "";
  function currentFiltered() {
    const key = JSON.stringify([
      [...state.selectedTags].sort(),
      state.yearFrom, state.yearTo, state.query,
    ]);
    if (key === filterKey && filterCache) return filterCache;

    const tags = state.selectedTags;
    const q = state.query;
    const from = state.yearFrom;
    const to = state.yearTo;

    const out = state.articles.filter(a => {
      const y = a.date.slice(0, 4);
      if (from && y < from) return false;
      if (to && y > to) return false;
      if (tags.size) {
        for (const t of tags) if (!a.tags.includes(t)) return false;
      }
      if (q) {
        const hay = (a.title + " " + a.authors.join(" ")).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    out.sort((a, b) => b.date.localeCompare(a.date) || b.issue - a.issue);

    filterKey = key;
    filterCache = out;
    return out;
  }

  // ── Render ──────────────────────────────────────────────────────────────
  function render() {
    const filtered = currentFiltered();
    renderStatus(filtered.length);
    renderArticles(filtered);
    updateFilterCount();
  }

  function renderStatus(n) {
    const total = state.articles.length;
    els.statusCount.textContent = "";
    const num = document.createElement("span");
    num.className = "total";
    num.textContent = n.toLocaleString("he-IL");
    els.statusCount.appendChild(num);
    const tail = document.createElement("span");
    tail.textContent = n === total
      ? ` · ${total.toLocaleString("he-IL")} מאמרים`
      : ` מתוך ${total.toLocaleString("he-IL")}`;
    els.statusCount.appendChild(tail);

    els.statusActive.textContent = "";
    const frag = document.createDocumentFragment();
    for (const t of state.selectedTags) frag.appendChild(chip("tag", t, t));
    if (state.yearFrom || state.yearTo) {
      frag.appendChild(chip("year", "year", `${state.yearFrom || "…"} – ${state.yearTo || "…"}`));
    }
    if (state.query) frag.appendChild(chip("q", "q", `"${state.query}"`));
    els.statusActive.appendChild(frag);
  }

  function chip(type, value, label) {
    const el = document.createElement("span");
    el.className = "active-chip";
    el.dataset.type = type;
    el.dataset.value = value;
    const text = document.createElement("span");
    text.textContent = label;
    const rm = document.createElement("span");
    rm.className = "remove";
    rm.textContent = "×";
    rm.title = "הסר סינון";
    el.appendChild(text);
    el.appendChild(rm);
    return el;
  }

  function renderArticles(filtered) {
    els.articles.textContent = "";
    if (filtered.length === 0) {
      els.empty.hidden = false;
      return;
    }
    els.empty.hidden = true;

    const slice = filtered.slice(0, state.shownCount);
    const frag = document.createDocumentFragment();
    for (const a of slice) frag.appendChild(articleEl(a));

    if (slice.length < filtered.length) {
      const more = document.createElement("div");
      more.style.cssText = "text-align:center;padding:20px 0;font-family:var(--font-mono);font-size:11px;color:var(--muted);letter-spacing:0.08em";
      more.textContent = `${slice.length.toLocaleString("he-IL")} / ${filtered.length.toLocaleString("he-IL")} — גלול להמשך`;
      frag.appendChild(more);
    }
    els.articles.appendChild(frag);
  }

  function articleEl(a) {
    const art = document.createElement("article");

    // Anchor column: issue-no · ord · date — all monospace, left-aligned (inline-start).
    const anchor = document.createElement("div");
    anchor.className = "article-anchor";
    const ordStr = a.id.split("-")[1] || "";
    const issueLabel = String(a.issue).padStart(3, "0");
    const issueEl = document.createElement("span");
    issueEl.className = "issue-no";
    issueEl.textContent = issueLabel;
    const ordEl = document.createElement("span");
    ordEl.className = "ord";
    ordEl.textContent = " ·" + ordStr;
    const dateEl = document.createElement("span");
    dateEl.className = "date";
    dateEl.textContent = a.date;
    anchor.appendChild(issueEl);
    anchor.appendChild(ordEl);
    anchor.appendChild(dateEl);
    art.appendChild(anchor);

    const body = document.createElement("div");
    body.className = "article-body";

    const titleA = document.createElement("a");
    titleA.className = "article-title";
    const href = safeHref(a.pdf || a.url);
    if (href) {
      titleA.href = href;
      titleA.target = "_blank";
      titleA.rel = "noopener noreferrer";
    }
    titleA.textContent = a.title;
    body.appendChild(titleA);

    const authors = document.createElement("div");
    authors.className = "article-authors";
    a.authors.forEach((author, i) => {
      if (i > 0) authors.appendChild(document.createTextNode("  ·  "));
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "author-link" + (state.query === author.toLowerCase() ? " active" : "");
      btn.dataset.author = author;
      btn.textContent = author;
      authors.appendChild(btn);
    });
    body.appendChild(authors);

    if (a.tags?.length) {
      const tagWrap = document.createElement("div");
      tagWrap.className = "article-tags";
      for (const t of a.tags) {
        const pill = document.createElement("button");
        pill.type = "button";
        pill.className = "pill" + (state.selectedTags.has(t) ? " active" : "");
        pill.dataset.tag = t;
        pill.textContent = t;
        tagWrap.appendChild(pill);
      }
      body.appendChild(tagWrap);
    }

    art.appendChild(body);
    return art;
  }

  // ── Utils ──────────────────────────────────────────────────────────────
  // Blocks javascript:, data:, and other script-executing schemes on href.
  function safeHref(url) {
    return typeof url === "string" && /^https?:\/\//i.test(url) ? url : null;
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }
})();
