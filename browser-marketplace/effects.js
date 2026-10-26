// Decorative UI effects only. No listing, storage, media or viewer state changes.
const HERO_IMAGE = JSON.parse($("hero-asset").textContent);
let sceneGlow = true;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const precisePointer = matchMedia("(hover: hover) and (pointer: fine)");
function neonScene() {
  return `<div class="hero-scene${sceneGlow ? "" : " scene-muted"}" data-tilt="hero" aria-label="Concept car studio artwork">
    <div class="scene-topline"><span><i></i> CONCEPT STUDIO</span><button type="button" class="scene-switch" data-scene-control aria-pressed="${sceneGlow}" aria-label="Toggle studio glow"><span aria-hidden="true">✦</span> <b>${sceneGlow ? "Glow on" : "Glow off"}</b></button></div>
    <div class="scene-grid" aria-hidden="true"></div><div class="scene-halo" aria-hidden="true"></div>
    <div class="scene-vehicle"><img class="hero-car" src="${HERO_IMAGE}" alt="Decorative silver concept sedan with lime and cyan studio lighting" draggable="false"></div>
    <div class="scene-coordinate" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
    <div class="scene-tag tag-orbit"><span class="tag-icon">↔</span><div><small>THE COMPLETE PICTURE</small><b>360° walk-around</b></div><i></i></div>
    <div class="scene-tag tag-detail"><span class="tag-icon">⊕</span><div><small>A CLOSER LOOK</small><b>Pinch. Zoom. Inspect.</b></div></div>
    <div class="scene-bottom"><span class="scene-caption">STUDIO ILLUSTRATION</span><span class="scene-instruction">Move your cursor to explore <b><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></b></span></div>
  </div>`;
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
  });
  document.addEventListener("click", (event) => {
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
