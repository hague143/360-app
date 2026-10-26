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
  // Read our own export Blob directly. This also works at file:// without
  // relying on fetch permissions for a blob:null URL.
  const exports = new Map();
  const createURL = URL.createObjectURL.bind(URL);
  const revokeURL = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = (blob) => {
    const url = createURL(blob);
    if (blob.type.startsWith("text/html")) exports.set(url, blob);
    return url;
  };
  URL.revokeObjectURL = (url) => {
    exports.delete(url);
    revokeURL(url);
  };
  const nativeClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.href.startsWith("blob:") && this.download.endsWith(".html")) {
      const request = capture;
      capture = null;
      const blob = exports.get(this.href);
      void (
        blob
          ? blob.text()
          : Promise.reject(new Error("Export data is unavailable."))
      )
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
    // The host owns persistence; the studio avoids a second browser-data copy.
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
      // Preserve the selected original clip as well as any extracted frames.
      // This listener wraps the trusted studio; its media/gesture code is intact.
      for (const id of ["video-file", "files"]) {
        document.getElementById(id)?.addEventListener("change", (event) => {
          const files = Array.from(event.target.files || []);
          if (
            files.length === 1 &&
            (files[0].type.startsWith("video/") ||
              /\.(mp4|webm|mov|m4v)$/i.test(files[0].name))
          )
            send("video", { file: files[0] });
        });
      }
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
  // This is our SHA-verified trusted module, never an imported HTML document.
  // Same-origin privilege is needed for native replacement confirmations:
  // browsers suppress confirm() in opaque/cross-origin frames.
  iframe.setAttribute(
    "sandbox",
    "allow-scripts allow-same-origin allow-downloads allow-modals",
  );
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
  const storageHost = doc.createElement("script");
  storageHost.textContent = `/* host-managed-studio-storage */
  try { Object.defineProperty(window,'indexedDB',{get(){throw new Error('The ad host manages studio persistence.');}}); } catch (_) {}
  document.currentScript.remove();`;
  // Remove this host-only setup before the original studio captures its own
  // export template. Native Save HTML copy remains a normal standalone app.
  doc.head.prepend(storageHost);
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
  // Cosmetic host theme only. The protected standalone studio stays byte-identical.
  style.textContent += `
  :root{color-scheme:dark;--ink:#edf4f9;--muted:#9cabbc;--green:#b650ff;--dark:#cd87ff;--line:#2d3d4b;--bg:#0c141e;--mint:#b650ff10;--white:#131e29;background:#0c141e;color:#edf4f9}
  body{background:#0c141e}.header{background:#101a25;border-color:#2d3d4b}.card,.aside-card{background:linear-gradient(135deg,#17232e,#101b26);border-color:#304351}.viewer-top,.viewer-tools,.controls{border-color:#2b3d4a}.viewer-tools{background:#111d28}.stage{background:radial-gradient(ellipse,#2a2031,#0d161f)}.stage.has-photos,.stage:fullscreen{background:#09121a}.stage.drag-over{box-shadow:inset 0 0 0 3px #b650ff;background:#281e30}
  .button,.icon-button,.mode-button{background:#192735;border-color:#3a4d5d;color:#dce8f1;box-shadow:0 3px 7px #00000018}.button:hover,.icon-button:hover:not(:disabled),.mode-button:hover{background:#273a45;border-color:#654e75}.button.primary{background:#b650ff;border-color:#d7a0ff;color:#180c20;box-shadow:0 0 20px #ad3bff12}.button.primary:hover{background:#d191ff}.play,.mode-button[aria-pressed=true]{background:#b650ff14;border-color:#a25ad640;color:#d5a5f7}.source-tabs{background:#0b141e;border:1px solid #283c4a}.source-tabs button{color:#9db0c0}.source-tabs button[aria-selected=true]{background:#2d1f37;color:#dfbdf8;box-shadow:0 0 15px #a82eff08}
  .field input,.field textarea,.field select{background:#0c1720;border-color:#354855;color:#ebf4f9}.field input::placeholder,.field textarea::placeholder{color:#8397a9}.field input:focus,.field textarea:focus,.field select:focus{outline-color:#b650ff;border-color:#944dc6}.field label,.loop-option label{color:#d4e0e9}.aside-card p,.empty p,.formats,.caption-row,.angle-total,.filename,.storage,.empty small,.gesture-help{color:#9eafbe}.aside-eyebrow,.eyebrow,.text-button,.film-actions button{color:#cb9bee}
  .frame-badge{background:#1c1422e8;border-color:#684780;color:#ecdbf8}.frame-badge span{color:#bcb3c3}.drag-hint{background:#291521df;color:#d2c4dc;border:1px solid #74588840}.empty-art{color:#a692b4}.empty-art span{background:#261d2c;border-color:#5b3b72;color:#d9aef8}.thumb{background:#172735}.thumb.selected{border-color:#b650ff}.thumb img{background:#0b151d}.thumb span{color:#acbdcc}.thumb b{background:#211728e8;color:#e4d0f2}.empty-film{border-color:#54485d;color:#a99eb1}.guide{background:#25192d}.guide h3{color:#e0cded}.guide p{color:#ad9fb7}.guide svg{color:#b650ff}.film-header h2 span,.selection-tools>span,.zoom-label{color:#9caebd}.divider{background:#314751}.video-preview{background:#08121a}.video-name{color:#a8b9c6}.loop-option{border-color:#3d3146}
  .notice{background:#32291d;color:#eddaad;border-color:#806d41}.notice.error{background:#331d22;color:#ffc1b0;border-color:#8c5147}.notice button{color:inherit}.help-dialog{background:#14202a;color:#e8f0f4;border-color:#4b3d55}.help-dialog p,.help-dialog li{color:#aabecb}.help-dialog strong{color:#efe7f4}.help-dialog::backdrop{background:#03090dbb}.selection-tools .remove{color:#ffb2a2}.stage-fullscreen-exit{background:#22131cea}
  `;
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
  if (message.type === "carview:video" && !studio.readOnly) {
    const ad = appState.ads.find((item) => item.id === studio.adId);
    if (ad && message.file instanceof Blob)
      void addVideo(message.file, ad).catch((error) => toast(error.message));
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
      " walk-around frames" +
      (ad.video ? " · 1 video" : "");
  if ($("studio-caption"))
    $("studio-caption").textContent = ad.studio.photos.length
      ? ad.studio.photos.length +
        " frames saved with this ad" +
        (ad.studio.loop
          ? " · Full-lap looping enabled"
          : " · Partial walk-around")
      : "Optional: add a photo sequence or a walk-around video. Your existing studio controls work here.";
}
