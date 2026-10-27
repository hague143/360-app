// The home showcase uses only user-selected photographs. No generated vehicle,
// remote image URL, recolouring or invented in-between angle is included.
function showroomData() {
  return appState.showroom || blankShowroom();
}
let showroomFrame = 0;
function showroomEditor(data) {
  return `<section class="showroom-editor" id="showroom-editor" hidden aria-label="Arrange showroom photos">
    <div class="showroom-editor-heading"><div><h3>Your actual photo angles</h3><p>Front → side → rear. Move photos into the order you want; each original view stays intact.</p></div><button class="btn small" data-action="choose-showroom">Replace photos</button></div>
    <ol class="showroom-order">${data.photos.map((photo, index) => `<li><img src="${esc(photo.thumb)}" alt=""><span>${index + 1}. ${esc(photo.name)}</span><button type="button" data-showroom-move="-1" data-index="${index}" aria-label="Move showroom photo ${index + 1} earlier" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-showroom-move="1" data-index="${index}" aria-label="Move showroom photo ${index + 1} later" ${index === data.photos.length - 1 ? "disabled" : ""}>↓</button></li>`).join("")}</ol>
    <label class="showroom-loop"><input id="showroom-full-lap" type="checkbox" ${data.fullLap ? "checked" : ""} ${data.photos.length < 12 ? "disabled" : ""}> These are consistent photos of the same car covering one complete lap (12+ photos).</label>
    <p class="showroom-honesty">Four different press photos show real photo angles. A seamless 360° spin needs a complete, consistently framed walk-around sequence. Colour, backgrounds and unseen sides are not generated.</p>
  </section>`;
}
async function importShowroom(files) {
  if (!files.length) return;
  if (mediaBusy)
    throw new Error("Let the current media finish preparing first.");
  if (files.length > 24) throw new Error("Choose up to 24 showroom photos.");
  const old = showroomData();
  if (
    old.photos.length &&
    !confirm(
      "Replace the home showroom photos? Your car ads and their media are kept.",
    )
  )
    return;
  mediaBusy = true;
  const progress = $("showroom-progress");
  if (progress) progress.hidden = false;
  try {
    const photos = [];
    for (let i = 0; i < files.length; i++) {
      if (progress)
        progress.textContent = `Preparing showroom photo ${i + 1} of ${files.length}…`;
      // Reuse the existing checked image decoder/display-copy pipeline.
      photos.push(await galleryPhoto(files[i]));
    }
    // Commit only a fully decoded batch. Failed/cancelled selection leaves the
    // previous sequence and every existing ad untouched.
    appState.showroom = cleanShowroom({ version: 1, photos, fullLap: false });
    showroomFrame = 0;
    persist();
    render();
    toast(
      "Your real photos are in the home box. Arrange angles if needed, then Save app copy to embed them in a portable HTML.",
    );
  } finally {
    mediaBusy = false;
    if (progress?.isConnected) progress.hidden = true;
  }
}
function mountPhotoShowroom(host, { playing = true } = {}) {
  const photos = showroomData().photos;
  let timer = null,
    disposed = false,
    visible = true,
    drag = null;
  const preloaded = [];
  showroomFrame = Math.max(0, Math.min(showroomFrame, photos.length - 1));
  function show(index) {
    if (disposed || !photos.length) return;
    showroomFrame = (index + photos.length) % photos.length;
    const photo = photos[showroomFrame],
      image = $("showroom-photo");
    if (image) {
      image.src = photo.src;
      image.alt = `White Lexus LX photo angle ${showroomFrame + 1} of ${photos.length}: ${photo.name}`;
    }
    host.dataset.frame = String(showroomFrame);
    if ($("showroom-counter"))
      $("showroom-counter").textContent =
        `${String(showroomFrame + 1).padStart(2, "0")} / ${String(photos.length).padStart(2, "0")}`;
    if ($("showroom-filename")) $("showroom-filename").textContent = photo.name;
    document.querySelectorAll("[data-showroom-frame]").forEach((button, i) => {
      button.classList.toggle("active", i === showroomFrame);
      button.setAttribute("aria-pressed", String(i === showroomFrame));
    });
  }
  function schedule() {
    clearTimeout(timer);
    if (
      !disposed &&
      playing &&
      visible &&
      !document.hidden &&
      photos.length > 1
    )
      timer = setTimeout(
        () => {
          show(showroomFrame + 1);
          schedule();
        },
        showroomData().fullLap ? 180 : 3200,
      );
  }
  function step(index) {
    show(index);
    schedule();
  }
  function down(e) {
    if (e.button !== 0 || photos.length < 2) return;
    drag = { x: e.clientX, y: e.clientY, index: showroomFrame };
    host.setPointerCapture(e.pointerId);
  }
  function move(e) {
    if (!drag) return;
    const dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    if (Math.abs(dy) > Math.abs(dx) + 20) {
      drag = null;
      return;
    }
    const offset = Math.trunc(-dx / 45);
    show(drag.index + offset);
  }
  function up() {
    drag = null;
    schedule();
  }
  function key(e) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    step(
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? photos.length - 1
          : showroomFrame + (e.key === "ArrowLeft" ? -1 : 1),
    );
  }
  function click(e) {
    const target = e.target.closest(
      "[data-showroom-frame],[data-showroom-step],[data-showroom-move]",
    );
    if (!target) return;
    if (target.hasAttribute("data-showroom-move")) {
      const index = Number(target.dataset.index),
        to = index + Number(target.dataset.showroomMove);
      if (!Number.isInteger(to) || to < 0 || to >= photos.length) return;
      const [photo] = photos.splice(index, 1);
      photos.splice(to, 0, photo);
      showroomFrame = to;
      persist();
      render();
      $("showroom-editor").hidden = false;
      document
        .querySelector('[data-action="showroom-editor"]')
        .setAttribute("aria-expanded", "true");
      return;
    }
    step(
      target.hasAttribute("data-showroom-frame")
        ? Number(target.dataset.showroomFrame)
        : showroomFrame + Number(target.dataset.showroomStep),
    );
  }
  function change(e) {
    if (e.target.id !== "showroom-full-lap") return;
    appState.showroom.fullLap = e.target.checked && photos.length >= 12;
    persist();
    render();
    $("showroom-editor").hidden = false;
  }
  function visibility() {
    schedule();
  }
  host.addEventListener("pointerdown", down);
  host.addEventListener("pointermove", move);
  host.addEventListener("pointerup", up);
  host.addEventListener("pointercancel", up);
  host.addEventListener("keydown", key);
  document.addEventListener("click", click);
  document.addEventListener("change", change);
  document.addEventListener("visibilitychange", visibility);
  const observer = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    schedule();
  });
  observer.observe(host);
  // At most 24 checked display copies; cache the next actual photos locally.
  for (const photo of photos) {
    const image = new Image();
    image.src = photo.src;
    preloaded.push(image);
  }
  show(showroomFrame);
  schedule();
  host.dataset.render = photos.length ? "photos" : "empty";
  return {
    setPlaying(value) {
      playing = value;
      schedule();
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
      observer.disconnect();
      preloaded.length = 0;
      host.removeEventListener("pointerdown", down);
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerup", up);
      host.removeEventListener("pointercancel", up);
      host.removeEventListener("keydown", key);
      document.removeEventListener("click", click);
      document.removeEventListener("change", change);
      document.removeEventListener("visibilitychange", visibility);
    },
  };
}
