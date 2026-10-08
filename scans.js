"use strict";

(() => {
  const root = document.getElementById("scan-viewer");
  const section = document.getElementById("scans");
  let started = false;

  async function loadScans() {
    if (started) return;
    started = true;
    try {
      const response = await fetch("data/scans.json?v=20261008-6");
      if (!response.ok) throw new Error("Manifest unavailable");
      const params = new URL(location.href).searchParams;
      const slice = Number(params.get("slice"));
      window.HealthDBScanViewer.mount(root, await response.json(), {
        baseUrl: location.href,
        initial: { study: params.get("scan"), series: params.get("series"), slice: Number.isInteger(slice) && slice > 0 ? slice : null }
      });
    } catch {
      const message = document.createElement("p");
      message.className = "scan-empty";
      message.textContent = "Scans could not be loaded.";
      root.replaceChildren(message);
    }
  }

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        loadScans();
      }
    }, { rootMargin: "150px" });
    observer.observe(section);
  } else {
    loadScans();
  }
})();
