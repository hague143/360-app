// Decorative UI effects only. No listing, storage, media or viewer state changes.
let sceneGlow = true;
let heroScene = null;
let heroPlaying = !matchMedia("(prefers-reduced-motion: reduce)").matches;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const precisePointer = matchMedia("(hover: hover) and (pointer: fine)");
function neonScene() {
  const data = showroomData(),
    hasPhotos = data.photos.length > 0;
  return `<div class="photo-showcase"><div class="hero-scene photo-scene${sceneGlow ? "" : " scene-muted"}${hasPhotos ? " has-real-photos" : ""}" data-tilt="hero" aria-label="Lexus LX real photo showcase">
    <div class="scene-topline"><span><i></i> LEXUS LX · WHITE</span><button type="button" class="scene-switch" data-scene-control aria-pressed="${sceneGlow}" aria-label="Toggle studio glow"><span aria-hidden="true">✦</span> <b>${sceneGlow ? "Glow on" : "Glow off"}</b></button></div>
    <div class="scene-vehicle" id="hero-vehicle" ${hasPhotos ? 'tabindex="0" role="group" aria-label="Actual car photo angles. Swipe, drag or use left and right arrow keys to change photo."' : ""}>
      ${hasPhotos ? `<img id="showroom-photo" class="showroom-photo" src="${esc(data.photos[Math.min(showroomFrame, data.photos.length - 1)].src)}" alt="White Lexus LX photo" draggable="false"><span class="showroom-photo-badge">REAL PHOTOS · ${data.fullLap ? "FULL LAP" : "PHOTO ANGLES"}</span>` : `<div class="showroom-empty"><div class="showroom-empty-mark" aria-hidden="true">▧</div><h2>Your Lexus. Real photos.</h2><p>Choose your four white Lexus photos directly from this computer.<br>They stay with your saved app copy.</p><button class="btn primary" data-action="choose-showroom">Choose Lexus photos</button><small>JPG, PNG, WebP · up to 24 photos · 10 MB each</small></div>`}
    </div>
    ${hasPhotos ? `<div class="showroom-photo-controls"><button type="button" data-showroom-step="-1" aria-label="Previous showroom photo">←</button><span id="showroom-counter"></span><button type="button" data-showroom-step="1" aria-label="Next showroom photo">→</button></div>` : ""}
    <div class="scene-bottom"><span class="scene-caption">${hasPhotos ? (data.fullLap ? "CAPTURED PHOTO SPIN · DRAG TO EXPLORE" : "ACTUAL PHOTO ANGLES · DRAG TO EXPLORE") : "YOUR ORIGINAL PHOTOS"}</span>${hasPhotos && data.photos.length > 1 ? `<button type="button" class="scene-switch" data-hero-play aria-pressed="${heroPlaying}" aria-label="${heroPlaying ? "Pause" : "Play"} showroom photos">${heroPlaying ? "Ⅱ Pause" : "▶ Play"}</button>` : ""}</div>
    </div><p class="photo-busy" id="showroom-progress" role="status" hidden></p>
    ${hasPhotos ? `<div class="showroom-photo-strip">${data.photos.map((photo, index) => `<button type="button" data-showroom-frame="${index}" aria-label="Showroom photo ${index + 1}" aria-pressed="${index === showroomFrame}" class="${index === showroomFrame ? "active" : ""}"><img src="${esc(photo.thumb)}" alt=""></button>`).join("")}</div><div class="showroom-actions"><button class="btn small" data-action="showroom-editor" aria-expanded="false">Arrange photos</button><button class="btn small primary" data-action="save-showroom">Save app copy</button></div><p class="showroom-source-note">Original photo angles. Different backgrounds stay as photographed.<br><span id="showroom-filename"></span></p>${showroomEditor(data)}` : ""}
  </div>`;
}
function disposeHero() {
  heroScene?.dispose();
  heroScene = null;
}
function mountHero() {
  const host = $("hero-vehicle");
  if (host) heroScene = mountPhotoShowroom(host, { playing: heroPlaying });
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
      (heroPlaying ? "Pause" : "Play") + " showroom photos",
    );
    control.textContent = heroPlaying ? "Ⅱ Pause" : "▶ Play";
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
