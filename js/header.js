/* Digital Whisper Index — shared header behavior.
 * Loaded on every page. Handles theme toggle, "/" shortcut, and the header
 * search. On sub-pages (no local article list), submitting the search
 * redirects to the index with the query applied. */
(() => {
  "use strict";

  const toggle = document.getElementById("theme-toggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      document.documentElement.classList.toggle("dark");
      const isDark = document.documentElement.classList.contains("dark");
      try { localStorage.setItem("dw-theme", isDark ? "dark" : "light"); } catch (e) {}
    });
  }

  const search = document.getElementById("q");
  // Index page owns its own search wiring via app.js.
  const isIndex = !!document.getElementById("articles");

  if (search) {
    document.addEventListener("keydown", (ev) => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const active = document.activeElement;
      const isEditable = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA");
      if (ev.key === "/" && !isEditable) {
        ev.preventDefault();
        search.focus();
        search.select();
      } else if (ev.key === "Escape" && active === search) {
        search.blur();
      }
    });
  }

  if (search && !isIndex) {
    search.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter") return;
      ev.preventDefault();
      const v = search.value.trim();
      window.location.href = v ? `./#q=${encodeURIComponent(v)}` : "./";
    });
  }
})();
