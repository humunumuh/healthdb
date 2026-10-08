"use strict";

(() => {
  const root = document.getElementById("scan-viewer");
  const section = document.getElementById("scans");
  let started = false;

  async function loadScans() {
    if (started) return;
    started = true;
    try {
      const response = await fetch("data/scans.json?v=20261008-4");
      if (!response.ok) throw new Error("Manifest unavailable");
      window.HealthDBScanViewer.mount(root, await response.json(), { baseUrl: location.href });
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
