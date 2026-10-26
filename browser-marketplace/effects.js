// Decorative UI effects only. No listing, storage, media or viewer state changes.
let sceneGlow = true;
let heroScene = null;
let heroPlaying = !matchMedia("(prefers-reduced-motion: reduce)").matches;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const precisePointer = matchMedia("(hover: hover) and (pointer: fine)");
function neonScene() {
  return `<div class="hero-scene${sceneGlow ? "" : " scene-muted"}" data-tilt="hero" aria-label="Black Land Cruiser 2026 display studio">
    <div class="scene-topline"><span><i></i> LAND CRUISER · 2026</span><button type="button" class="scene-switch" data-scene-control aria-pressed="${sceneGlow}" aria-label="Toggle studio glow"><span aria-hidden="true">✦</span> <b>${sceneGlow ? "Glow on" : "Glow off"}</b></button></div>
    <div class="scene-grid" aria-hidden="true"></div><div class="scene-halo" aria-hidden="true"></div>
    <div class="scene-vehicle" id="hero-vehicle"><svg class="hero-fallback" viewBox="0 0 600 300" role="img" aria-label="Black SUV display illustration"><defs><linearGradient id="suv-paint" x2="0.3" y2="1"><stop stop-color="#788096"/><stop offset=".3" stop-color="#181c2b"/><stop offset="1" stop-color="#060810"/></linearGradient></defs><ellipse cx="300" cy="255" rx="230" ry="20" fill="#ba70ff" opacity=".14"/><path d="M82 219V139L145 120 199 61 413 61 459 126 516 147 535 218Z" fill="url(#suv-paint)" stroke="#9f8fb8" stroke-width="3"/><path d="M175 120 211 74 399 74 430 120Z" fill="#23263c" stroke="#c0b7dc" stroke-width="2"/><path d="M272 75V120M365 75V120M290 136V218M423 133V218" stroke="#8c83a5" stroke-width="2"/><path d="M88 151H150M461 153H517" stroke="#eee5ff" stroke-width="8"/><path d="M101 195H520" stroke="#485062" stroke-width="6"/><g fill="#0a0c11" stroke="#697089" stroke-width="8"><circle cx="179" cy="220" r="41"/><circle cx="439" cy="220" r="41"/></g><g fill="#9293a5"><circle cx="179" cy="220" r="24"/><circle cx="439" cy="220" r="24"/></g></svg></div>
    <div class="scene-coordinate" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
    <div class="scene-tag tag-orbit"><span class="tag-icon">↔</span><div><small>BLACK / 2026</small><b>Land Cruiser</b></div><i></i></div>
    <div class="scene-tag tag-detail"><span class="tag-icon">⊕</span><div><small>A CLOSER LOOK</small><b>Pinch. Zoom. Inspect.</b></div></div>
    <div class="scene-bottom"><span class="scene-caption">3D ILLUSTRATION · DRAG TO ROTATE</span><button type="button" class="scene-switch" data-hero-play aria-pressed="${heroPlaying}" aria-label="${heroPlaying ? "Pause" : "Play"} showroom rotation">${heroPlaying ? "Ⅱ Pause" : "▶ Rotate"}</button></div>
  </div>`;
}
function disposeHero() {
  heroScene?.dispose();
  heroScene = null;
}
function mountHero() {
  const host = $("hero-vehicle");
  if (!host) return;
  heroScene = CarViewHero.mount(host, { reducedMotion: !heroPlaying });
  if (host.dataset.render === "fallback") {
    document.querySelector("[data-hero-play]").hidden = true;
    document.querySelector(".scene-caption").textContent =
      "DISPLAY ILLUSTRATION";
  }
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
      (heroPlaying ? "Pause" : "Play") + " showroom rotation",
    );
    control.textContent = heroPlaying ? "Ⅱ Pause" : "▶ Rotate";
  }
  document.addEventListener("click", (event) => {
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
