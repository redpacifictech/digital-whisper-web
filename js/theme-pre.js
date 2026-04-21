// Sets theme class before first paint to avoid FOUC.
// Loaded synchronously in <head> so no defer/async.
(function () {
  try {
    if (localStorage.getItem("dw-theme") === "light") {
      document.documentElement.classList.remove("dark");
    }
  } catch (e) {}
})();
