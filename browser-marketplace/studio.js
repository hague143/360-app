// The original studio is embedded unchanged. This wrapper handles only host
// integration, portable snapshot capture, sizing and buyer/editor presentation.
const STUDIO_HTML = JSON.parse($("studio-source").textContent);
function studioBridge(config) {
  const send = (type, extra = {}) =>
    parent.postMessage(
      { type: "carview:" + type, token: config.token, ...extra },
      "*",
    );
  let capture = null,
    dirty = false,
    debounce = null;
  const nativeClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.href.startsWith("blob:") && this.download.endsWith(".html")) {
      const request = capture;
      capture = null;
      void fetch(this.href)
        .then((response) => response.text())
        .then((text) => {
          const parsed = new DOMParser().parseFromString(text, "text/html");
          const project = JSON.parse(
            parsed.getElementById("carview-data").textContent,
          );
          send("snapshot", { requestId: request?.id || null, project });
        })
        .catch((error) =>
          send("error", {
            requestId: request?.id || null,
            message: "Could not save the 360 view: " + error.message,
          }),
        );
      if (request) return;
    }
    nativeClick.call(this);
  };
  function snapshot(id) {
    const button = document.getElementById("export");
    if (!button || button.disabled || !document.getElementById("busy").hidden) {
      send("error", {
        requestId: id,
        message:
          "360 processing is still running. Let it finish or cancel it before continuing.",
      });
      return;
    }
    const box = document.getElementById("notice"),
      text = document.getElementById("notice-text");
    const before = {
      hidden: box.hidden,
      text: text.textContent,
      className: box.className,
    };
    capture = { id };
    button.click();
    // A host snapshot is a save, not a user-requested standalone download.
    box.hidden = before.hidden;
    text.textContent = before.text;
    box.className = before.className;
    if (capture) {
      capture = null;
      send("error", {
        requestId: id,
        message:
          "Could not capture the 360 view. Please try its Save HTML copy button.",
      });
    }
  }
  function changed() {
    dirty = true;
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      if (!dirty) return;
      if (!document.getElementById("busy").hidden) {
        changed();
        return;
      }
      dirty = false;
      snapshot(null);
    }, 700);
  }
  window.addEventListener("message", (event) => {
    if (event.source !== parent || event.data?.token !== config.token) return;
    if (event.data.type === "carview:capture") snapshot(event.data.requestId);
    if (event.data.type === "carview:storage")
      document.getElementById("storage-status").textContent =
        event.data.message;
  });
  function ready() {
    if (document.documentElement.dataset.ready !== "true") return false;
    // The host owns persistence. A sandboxed child intentionally has no IndexedDB.
    const box = document.getElementById("notice");
    if (
      document
        .getElementById("notice-text")
        .textContent.includes("Browser storage available nahi")
    )
      box.hidden = true;
    document.getElementById("storage-status").textContent = config.readOnly
      ? "Included in this car ad"
      : "360 photos save with this ad";
    if (!config.readOnly) {
      new MutationObserver(changed).observe(
        document.getElementById("filmstrip"),
        { childList: true },
      );
      document.getElementById("loop").addEventListener("change", changed);
    }
    let lastHeight = 0;
    const resize = () => {
      const height = Math.ceil(document.body.scrollHeight);
      if (Math.abs(height - lastHeight) > 2) {
        lastHeight = height;
        send("height", { height });
      }
    };
    new ResizeObserver(resize).observe(document.body);
    resize();
    send("ready");
    return true;
  }
  if (!ready()) {
    const observer = new MutationObserver(() => {
      if (ready()) observer.disconnect();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-ready"],
    });
  }
}
function mountStudio(host, ad, readOnly = false) {
  const iframe = document.createElement("iframe");
  iframe.className = "studio-frame" + (readOnly ? " buyer-frame" : "");
  iframe.title = readOnly
    ? "Interactive car photo walk-around"
    : "Add your car photos or video in the 360 studio";
  iframe.setAttribute("sandbox", "allow-scripts allow-downloads allow-modals");
  iframe.setAttribute("allow", "fullscreen *");
  iframe.allowFullscreen = true;
  const token = uid();
  let resolveReady;
  const readyPromise = new Promise((resolve) => (resolveReady = resolve));
  activeStudio = {
    iframe,
    token,
    adId: ad.id,
    readOnly,
    pending: new Map(),
    ready: false,
    readyPromise,
    resolveReady,
  };
  const doc = new DOMParser().parseFromString(STUDIO_HTML, "text/html");
  const project = structuredClone(ad.studio);
  project.title = [makeOf(ad), modelOf(ad), ad.details.variant]
    .filter(Boolean)
    .join(" ");
  project.year = ad.details.year;
  project.city = ad.details.city;
  project.notes = ad.details.description.slice(0, 1500);
  doc.getElementById("carview-data").textContent = jsonSafe(project);
  // Append after the original script so its pristine export template and all
  // media/gesture logic stay intact. No code in the source studio is rewritten.
  const style = doc.createElement("style");
  style.textContent = readOnly
    ? ".header,.intro,.footer,.aside,.film-header,.filmstrip,.selection-tools,.guide,#busy{display:none!important}.workspace{display:block!important}.wrap{padding:0!important;max-width:none!important}.card{border:0!important}.stage{height:400px}.notice{margin:10px}@media(max-width:760px){.stage{height:320px}}"
    : ".brand,.header-label,.header-actions>.pill,.intro,.footer,.aside-card:nth-child(2){display:none!important}.header-inner{min-height:54px!important;padding:0 16px!important;max-width:none!important}.header-actions{margin-left:auto!important}main.wrap{padding:15px!important;max-width:none!important}.workspace{grid-template-columns:minmax(0,1fr) 250px!important;gap:15px!important}.stage{height:330px!important}.guide{margin-bottom:0!important}@media(max-width:1000px){.workspace{grid-template-columns:minmax(0,1fr)!important}.aside{display:block!important}.stage{height:300px!important}}";
  doc.body.append(style);
  const bridge = doc.createElement("script");
  bridge.textContent =
    "(" + studioBridge.toString() + ")(" + jsonSafe({ token, readOnly }) + ");";
  doc.body.append(bridge);
  iframe.srcdoc = "<!doctype html>\n" + doc.documentElement.outerHTML;
  host.replaceChildren(iframe);
}
function studioMessage(event) {
  const studio = activeStudio,
    message = event.data;
  if (
    !studio ||
    event.source !== studio.iframe.contentWindow ||
    message?.token !== studio.token ||
    typeof message.type !== "string"
  )
    return;
  if (message.type === "carview:height" && Number.isFinite(message.height))
    studio.iframe.style.height =
      Math.max(studio.readOnly ? 450 : 650, Math.min(6000, message.height)) +
      "px";
  if (message.type === "carview:ready") {
    studio.ready = true;
    studio.resolveReady();
  }
  if (message.type === "carview:snapshot" && !studio.readOnly) {
    const pending = studio.pending.get(message.requestId);
    if (pending) {
      clearTimeout(pending.timer);
      studio.pending.delete(message.requestId);
    }
    try {
      const ad = appState.ads.find((ad) => ad.id === studio.adId);
      if (!ad) throw new Error("The draft is no longer available.");
      const project = cleanStudio(message.project);
      project.id = ad.studio.id;
      ad.studio = project;
      persist(ad);
      updateMediaSummary(ad);
      pending?.resolve(project);
    } catch (error) {
      pending?.reject(error);
      toast(error.message);
    }
  }
  if (message.type === "carview:error") {
    const pending = studio.pending.get(message.requestId);
    if (pending) {
      clearTimeout(pending.timer);
      studio.pending.delete(message.requestId);
      pending.reject(new Error(message.message));
    } else toast(message.message || "Could not save the 360 view.");
  }
}
async function captureStudio() {
  const studio = activeStudio;
  if (!studio || studio.readOnly) return;
  if (!studio.ready)
    await Promise.race([
      studio.readyPromise,
      new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                "The 360 studio is still opening. Try again in a moment.",
              ),
            ),
          12000,
        ),
      ),
    ]);
  return await new Promise((resolve, reject) => {
    const requestId = uid(),
      timer = setTimeout(() => {
        studio.pending.delete(requestId);
        reject(
          new Error("The 360 view could not be saved yet. Please try again."),
        );
      }, 12000);
    studio.pending.set(requestId, { resolve, reject, timer });
    studio.iframe.contentWindow.postMessage(
      { type: "carview:capture", token: studio.token, requestId },
      "*",
    );
  });
}
function detachStudio() {
  if (activeStudio) {
    for (const entry of activeStudio.pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(new Error("360 view closed."));
    }
    activeStudio = null;
  }
}
function updateMediaSummary(ad) {
  if ($("media-count"))
    $("media-count").textContent =
      ad.gallery.length +
      " photos · " +
      ad.studio.photos.length +
      " walk-around frames";
  if ($("studio-caption"))
    $("studio-caption").textContent = ad.studio.photos.length
      ? ad.studio.photos.length +
        " frames saved with this ad" +
        (ad.studio.loop
          ? " · Full-lap looping enabled"
          : " · Partial walk-around")
      : "Optional: add a photo sequence or a walk-around video. Your existing studio controls work here.";
}
