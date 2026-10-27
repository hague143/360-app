// Decorative UI effects only. No listing, storage, media or viewer state changes.
const MODEL_ASSET = JSON.parse($("hero-model-data").textContent);
const LANDING_ART = JSON.parse($("landing-art-data").textContent);
let sceneGlow = true;
let heroScene = null;
let heroPlaying = !matchMedia("(prefers-reduced-motion: reduce)").matches;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const precisePointer = matchMedia("(hover: hover) and (pointer: fine)");
function modelScene() {
  return `<div class="model-showcase"><div class="hero-scene model-scene${sceneGlow ? "" : " scene-muted"}" data-tilt="hero" aria-label="Koenigsegg Agera model showcase">
    <div class="scene-topline"><span><i></i> KOENIGSEGG · AGERA</span><button type="button" class="scene-switch" data-scene-control aria-pressed="${sceneGlow}" aria-label="Toggle studio glow"><span aria-hidden="true">✦</span> <b>${sceneGlow ? "Glow on" : "Glow off"}</b></button></div>
    <div class="scene-vehicle" id="hero-vehicle" tabindex="0" role="group" aria-label="Interactive Koenigsegg 3D model. Drag to orbit, pinch or scroll to zoom, 0 resets view."><img class="model-poster" id="model-poster" src="${MODEL_ASSET.poster}" alt="Koenigsegg 3D model preview"><span class="model-status" id="model-status" role="status">Opening 3D view…</span></div>
    <div class="model-tools" role="group" aria-label="3D model controls"><button type="button" data-model-control="zoom-in" aria-label="Zoom in on 3D model">＋</button><button type="button" data-model-control="zoom-out" aria-label="Zoom out from 3D model">−</button><button type="button" data-model-control="reset">Reset view</button></div>
    <div class="scene-bottom"><span class="scene-caption">3D MODEL · DRAG TO ORBIT · PINCH TO ZOOM</span><button type="button" class="scene-switch" data-hero-play aria-pressed="${heroPlaying}" aria-label="${heroPlaying ? "Pause" : "Play"} model rotation">${heroPlaying ? "Ⅱ Pause" : "▶ Rotate"}</button></div>
    </div><div class="showroom-actions"><button class="btn small primary" data-action="save-showroom">Save app copy</button></div><p class="showroom-source-note">Drag to explore every curve. Pinch to get closer.</p></div>`;
}
function neonScene() {
  return `<div class="showroom-choice">${modelScene()}</div>`;
}
function landingBackdrop() {
  return `<div class="landing-backdrop" id="landing-backdrop" aria-hidden="true"><img id="landing-car-art" src="${LANDING_ART}" alt="" draggable="false"><div class="landing-shade"></div></div>`;
}
function disposeHero() {
  heroScene?.dispose();
  heroScene = null;
}
function mountHero() {
  const host = $("hero-vehicle");
  if (!host) return;
  host.dataset.render = "loading";
  heroScene = CarViewModel.mount(host, {
    base64: MODEL_ASSET.base64,
    playing: heroPlaying,
    onReady: () => {
      $("model-poster").hidden = true;
      $("model-status").hidden = true;
    },
    onError: () => {
      if ($("model-poster")) $("model-poster").hidden = false;
      if ($("model-status"))
        $("model-status").textContent =
          "Static preview · 3D is unavailable on this browser";
      document
        .querySelectorAll("[data-model-control],[data-hero-play]")
        .forEach((button) => (button.disabled = true));
    },
  });
}

function installEffects() {
  let active = null,
    pending = null,
    animation = null;
  function reset(element) {
    if (!element) return;
    element.style.setProperty("--rx", "0deg");
    element.style.setProperty("--ry", "0deg");
    element.style.setProperty("--px", "50%");
    element.style.setProperty("--py", "50%");
  }
  document.addEventListener("pointermove", (event) => {
    if (reduceMotion.matches || !precisePointer.matches) return;
    const element = event.target.closest("[data-tilt]");
    if (element !== active) {
      reset(active);
      active = element;
    }
    if (!element) return;
    pending = { element, x: event.clientX, y: event.clientY };
    if (animation) return;
    animation = requestAnimationFrame(() => {
      animation = null;
      if (!pending || pending.element !== active || !active?.isConnected)
        return;
      const box = active.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (pending.x - box.left) / box.width));
      const y = Math.max(0, Math.min(1, (pending.y - box.top) / box.height));
      const strength = active.dataset.tilt === "hero" ? 7 : 3;
      active.style.setProperty(
        "--rx",
        ((0.5 - y) * strength).toFixed(2) + "deg",
      );
      active.style.setProperty(
        "--ry",
        ((x - 0.5) * strength).toFixed(2) + "deg",
      );
      active.style.setProperty("--px", (x * 100).toFixed(1) + "%");
      active.style.setProperty("--py", (y * 100).toFixed(1) + "%");
    });
  });
  document.addEventListener("pointerout", (event) => {
    if (active && !active.contains(event.relatedTarget)) {
      reset(active);
      active = null;
    }
  });
  reduceMotion.addEventListener("change", () => {
    reset(active);
    active = null;
    heroPlaying = !reduceMotion.matches;
    heroScene?.setPlaying(heroPlaying);
    updateHeroControl();
  });
  function updateHeroControl() {
    const control = document.querySelector("[data-hero-play]");
    if (!control) return;
    control.setAttribute("aria-pressed", String(heroPlaying));
    control.setAttribute(
      "aria-label",
      (heroPlaying ? "Pause" : "Play") + " model rotation",
    );
    control.textContent = heroPlaying ? "Ⅱ Pause" : "▶ Rotate";
  }
  document.addEventListener("click", (event) => {
    const modelControl = event.target.closest("[data-model-control]");
    if (modelControl && !modelControl.disabled) {
      const kind = modelControl.dataset.modelControl;
      if (kind === "reset") heroScene?.reset();
      else heroScene?.zoom(kind === "zoom-in" ? 0.85 : 1.18);
    }
    if (event.target.closest("[data-hero-play]")) {
      heroPlaying = !heroPlaying;
      heroScene?.setPlaying(heroPlaying);
      updateHeroControl();
    }
    const toggle = event.target.closest("[data-scene-control]");
    if (toggle) {
      sceneGlow = !sceneGlow;
      toggle.closest(".hero-scene").classList.toggle("scene-muted", !sceneGlow);
      toggle.setAttribute("aria-pressed", String(sceneGlow));
      toggle.querySelector("b").textContent = sceneGlow
        ? "Glow on"
        : "Glow off";
    }
    const search = event.target.closest("[data-find-car]");
    if (search) {
      $("search-form")?.scrollIntoView({
        behavior: reduceMotion.matches ? "instant" : "smooth",
        block: "center",
      });
      $("search-query")?.focus({ preventScroll: true });
    }
    const button = event.target.closest(".btn");
    if (!button || button.disabled || reduceMotion.matches) return;
    const box = button.getBoundingClientRect(),
      ripple = document.createElement("span");
    ripple.className = "button-ripple";
    ripple.setAttribute("aria-hidden", "true");
    ripple.style.left =
      (event.clientX || box.left + box.width / 2) - box.left + "px";
    ripple.style.top =
      (event.clientY || box.top + box.height / 2) - box.top + "px";
    button.append(ripple);
    setTimeout(() => ripple.remove(), 650);
  });
}
