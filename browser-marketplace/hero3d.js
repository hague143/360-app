// Procedural display model. No remote models/textures, uploads or network calls.
// Land Cruiser 300-inspired illustration, not a measured Toyota CAD asset.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export function mount(host, { reducedMotion = false } = {}) {
  const fallback = host.querySelector(".hero-fallback");
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
  } catch (_) {
    host.dataset.render = "fallback";
    return { dispose() {}, setPlaying() {} };
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.7));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.domElement.className = "hero-car";
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.setAttribute(
    "aria-label",
    "Rotating black 2026 Land Cruiser-inspired 3D display model",
  );
  host.append(renderer.domElement);
  if (fallback) fallback.hidden = true;
  host.dataset.render = "webgl";
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(29, 1, 0.1, 50);
  camera.position.set(7.9, 4, 8.3);
  camera.lookAt(0, 1.05, 0);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.045);
  scene.environment = environment.texture;
  room.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xe7dfff, 0x23102f, 2));
  function light(color, intensity, x, y, z) {
    const l = new THREE.DirectionalLight(color, intensity);
    l.position.set(x, y, z);
    scene.add(l);
  }
  light(0xffffff, 3.2, 5, 7, 3);
  light(0xa06dff, 4, -4, 3, 2);
  light(0xff4eb8, 3, 2, 3, -4);
  const car = new THREE.Group();
  scene.add(car);
  const material = (color, metalness = 0.0, roughness = 0.4) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const paint = new THREE.MeshPhysicalMaterial({
    color: 0x090b13,
    metalness: 0.88,
    roughness: 0.23,
    clearcoat: 1,
    clearcoatRoughness: 0.13,
  });
  const rubber = material(0x0a0c11, 0.02, 0.85),
    trim = material(0x151a23, 0.45, 0.4);
  const chrome = material(0xa0a6b7, 0.95, 0.22),
    darkChrome = material(0x414c60, 0.9, 0.23);
  const glass = material(0x192335, 0.84, 0.14);
  const whiteLED = new THREE.MeshStandardMaterial({
    color: 0xe9f6ff,
    emissive: 0xa0d4ff,
    emissiveIntensity: 2.1,
  });
  const rearLED = new THREE.MeshStandardMaterial({
    color: 0xe82852,
    emissive: 0xff123b,
    emissiveIntensity: 1.7,
  });
  function box(w, h, d, x, y, z, mat = paint, parent = car, radius = 0) {
    let geometry;
    if (radius) {
      const shape = new THREE.Shape();
      const a = w / 2,
        b = h / 2,
        r = Math.min(radius, a, b);
      shape.moveTo(-a + r, -b);
      shape.lineTo(a - r, -b);
      shape.quadraticCurveTo(a, -b, a, -b + r);
      shape.lineTo(a, b - r);
      shape.quadraticCurveTo(a, b, a - r, b);
      shape.lineTo(-a + r, b);
      shape.quadraticCurveTo(-a, b, -a, b - r);
      shape.lineTo(-a, -b + r);
      shape.quadraticCurveTo(-a, -b, -a + r, -b);
      geometry = new THREE.ExtrudeGeometry(shape, {
        depth: d - 0.04,
        bevelEnabled: true,
        bevelThickness: 0.02,
        bevelSize: 0.02,
        bevelSegments: 2,
        steps: 1,
        curveSegments: 3,
      });
      geometry.translate(0, 0, -(d - 0.04) / 2);
    } else geometry = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  function panel(points, mat = glass) {
    const geometry = new THREE.BufferGeometry();
    const vertices = points.flat();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, mat.clone());
    mesh.material.side = THREE.DoubleSide;
    car.add(mesh);
    return mesh;
  }
  // Frame, broad bonnet and tall LC300-style cabin.
  box(4.96, 0.52, 1.96, 0, 0.91, 0, paint, car, 0.13);
  box(4.7, 0.27, 1.9, 0, 0.62, 0, trim, car, 0.08);
  box(2.1, 0.38, 1.89, 1.3, 1.22, 0, paint, car, 0.1);
  box(1.72, 0.09, 1.83, 1.38, 1.44, 0, paint, car, 0.04);
  box(3.17, 0.7, 1.87, -0.72, 1.3, 0, paint, car, 0.08);
  box(2.81, 0.12, 1.73, -0.7, 1.98, 0, paint, car, 0.06);
  // Separate windows reveal the pillars and each individual door.
  for (const side of [-1, 1]) {
    const z = side * 0.955;
    panel([
      [0.88, 1.45, z],
      [0.58, 1.89, side * 0.846],
      [-0.57, 1.89, side * 0.846],
      [-0.57, 1.45, z],
    ]);
    panel([
      [-0.67, 1.45, z],
      [-0.67, 1.89, side * 0.846],
      [-1.58, 1.89, side * 0.846],
      [-1.69, 1.45, z],
    ]);
    panel([
      [-1.79, 1.45, z],
      [-1.68, 1.89, side * 0.846],
      [-2.05, 1.87, side * 0.846],
      [-2.22, 1.45, z],
    ]);
    box(3.8, 0.035, 0.035, -0.53, 1.418, side * 0.965, chrome);
    // Door gaps, pull handles, steps and squared wheel-arch lips.
    for (const x of [-1.75, -0.62, 0.93])
      box(0.014, 0.63, 0.012, x, 1.1, side * 0.99, trim);
    for (const x of [0.1, -1.18])
      box(0.23, 0.045, 0.045, x, 1.32, side * 1.0, chrome, car, 0.018);
    box(3.32, 0.11, 0.22, -0.06, 0.48, side * 1.02, darkChrome, car, 0.035);
    for (const x of [-1.48, 1.48]) {
      const arc = new THREE.Mesh(
        new THREE.TorusGeometry(0.535, 0.048, 5, 32, Math.PI),
        trim,
      );
      arc.position.set(x, 0.55, side * 1.0);
      car.add(arc);
    }
    box(0.11, 0.06, 0.16, 0.85, 1.54, side * 1.03, darkChrome);
    box(0.32, 0.15, 0.21, 0.84, 1.59, side * 1.13, paint, car, 0.045);
    box(0.24, 0.025, 0.014, 0.85, 1.6, side * 1.241, whiteLED);
    box(2.54, 0.045, 0.045, -0.72, 2.066, side * 0.71, darkChrome);
    for (const x of [-1.67, 0.24])
      box(0.1, 0.09, 0.04, x, 2.02, side * 0.71, trim);
  }
  panel([
    [1.12, 1.47, -0.866],
    [1.12, 1.47, 0.866],
    [0.61, 1.91, 0.81],
    [0.61, 1.91, -0.81],
  ]);
  panel([
    [-2.32, 1.43, 0.85],
    [-2.32, 1.43, -0.85],
    [-2.12, 1.88, -0.8],
    [-2.12, 1.88, 0.8],
  ]);
  // Front: large horizontal grille, shoulder lamps, skid plate.
  box(0.08, 0.61, 1.7, 2.494, 1.05, 0, trim, car, 0.04);
  for (let y = 0.84; y <= 1.31; y += 0.092)
    box(0.1, 0.042, 1.5, 2.543, y, 0, chrome);
  box(0.07, 0.17, 0.26, 2.61, 1.1, 0, darkChrome, car, 0.03);
  const badge = new THREE.Mesh(
    new THREE.TorusGeometry(0.066, 0.012, 6, 22),
    chrome,
  );
  badge.rotation.y = Math.PI / 2;
  badge.scale.y = 0.68;
  badge.position.set(2.65, 1.1, 0);
  car.add(badge);
  for (const side of [-1, 1]) {
    box(0.08, 0.15, 0.5, 2.45, 1.355, side * 0.7, trim, car, 0.04);
    box(0.095, 0.045, 0.46, 2.502, 1.4, side * 0.7, whiteLED);
    for (const z of [0.55, 0.68, 0.81])
      box(0.095, 0.058, 0.07, 2.507, 1.325, side * z, whiteLED);
    box(0.07, 0.09, 0.24, 2.46, 0.73, side * 0.73, darkChrome);
    box(0.09, 0.025, 0.16, 2.5, 0.74, side * 0.73, whiteLED);
  }
  box(0.15, 0.14, 1.57, 2.4, 0.57, 0, darkChrome, car, 0.04);
  box(0.03, 0.13, 0.4, 2.607, 0.84, 0, material(0x1d2233));
  // Tailgate, brake-light clusters, rear bumper and spoiler.
  box(0.06, 0.67, 1.79, -2.48, 1.05, 0, paint, car, 0.04);
  box(0.08, 0.09, 1.82, -2.48, 1.92, 0, paint, car, 0.03);
  box(0.09, 0.05, 1.57, -2.53, 1.34, 0, chrome);
  for (const side of [-1, 1]) {
    box(0.1, 0.16, 0.42, -2.53, 1.37, side * 0.69, rearLED, car, 0.025);
    box(0.15, 0.04, 0.44, -2.54, 1.4, side * 0.69, rearLED);
    box(0.07, 0.065, 0.23, -2.53, 0.64, side * 0.74, rearLED);
  }
  box(0.06, 0.2, 0.5, -2.535, 1.06, 0, trim, car, 0.025);
  box(0.12, 0.13, 1.6, -2.43, 0.55, 0, darkChrome, car, 0.04);
  // Four static road wheels. The display platform turns; the parked wheels don't roll.
  for (const x of [-1.48, 1.48])
    for (const side of [-1, 1]) {
      const wheel = new THREE.Group();
      wheel.position.set(x, 0.55, side * 0.98);
      car.add(wheel);
      const tire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.47, 0.47, 0.25, 40),
        rubber,
      );
      tire.rotation.x = Math.PI / 2;
      wheel.add(tire);
      const z = side * 0.14;
      const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.315, 0.315, 0.02, 32),
        darkChrome,
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.z = z;
      wheel.add(rim);
      const lip = new THREE.Mesh(
        new THREE.TorusGeometry(0.305, 0.025, 8, 40),
        chrome,
      );
      lip.position.z = z + side * 0.015;
      wheel.add(lip);
      const brake = new THREE.Mesh(
        new THREE.CylinderGeometry(0.23, 0.23, 0.018, 28),
        trim,
      );
      brake.rotation.x = Math.PI / 2;
      brake.position.z = z + side * 0.02;
      wheel.add(brake);
      for (let i = 0; i < 6; i++)
        for (const split of [-1, 1]) {
          const a = (i * Math.PI) / 3 + split * 0.09;
          const spoke = box(
            0.045,
            0.255,
            0.027,
            Math.sin(a) * 0.17,
            Math.cos(a) * 0.17,
            z + side * 0.04,
            chrome,
            wheel,
          );
          spoke.rotation.z = -a;
        }
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.073, 0.073, 0.045, 20),
        chrome,
      );
      hub.rotation.x = Math.PI / 2;
      hub.position.z = z + side * 0.05;
      wheel.add(hub);
    }
  // Soft contact shadow and luminous turntable rings, all generated locally.
  const ground = new THREE.Group();
  scene.add(ground);
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const ctx = shadowCanvas.getContext("2d");
  const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  gradient.addColorStop(0, "#000000c0");
  gradient.addColorStop(1, "#00000000");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 4.2),
    new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  ground.add(shadow);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xc77aff,
    transparent: true,
    opacity: 0.55,
  });
  for (const radius of [3.08, 3.2]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.007, 5, 100),
      ringMat,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.012;
    ground.add(ring);
  }
  car.rotation.y = -0.35;
  let playing = !reducedMotion,
    disposed = false,
    dragging = false,
    lastX = 0,
    animation = null,
    previous = 0;
  const observer = new ResizeObserver(() => resize());
  observer.observe(host);
  function resize() {
    const w = host.clientWidth,
      h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.set(7.1, 3.4, 7.5);
    if (w / h < 1.15) camera.position.multiplyScalar(1.16);
    camera.updateProjectionMatrix();
    draw();
  }
  function draw() {
    if (disposed) return;
    renderer.render(scene, camera);
    host.dataset.angle = car.rotation.y.toFixed(3);
  }
  function tick(now) {
    animation = requestAnimationFrame(tick);
    if (document.hidden || !host.isConnected) {
      previous = now;
      return;
    }
    const delta = Math.min((now - previous) / 1000, 0.08);
    previous = now;
    if (playing && !dragging) {
      car.rotation.y += (delta * Math.PI * 2) / 24;
      draw();
    }
  }
  function pointerdown(e) {
    dragging = true;
    lastX = e.clientX;
    host.setPointerCapture(e.pointerId);
  }
  function pointermove(e) {
    if (!dragging) return;
    car.rotation.y += (e.clientX - lastX) * 0.012;
    lastX = e.clientX;
    draw();
  }
  function pointerup() {
    dragging = false;
  }
  host.addEventListener("pointerdown", pointerdown);
  host.addEventListener("pointermove", pointermove);
  host.addEventListener("pointerup", pointerup);
  host.addEventListener("pointercancel", pointerup);
  resize();
  animation = requestAnimationFrame(tick);
  return {
    setPlaying(value) {
      playing = value;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(animation);
      observer.disconnect();
      host.removeEventListener("pointerdown", pointerdown);
      host.removeEventListener("pointermove", pointermove);
      host.removeEventListener("pointerup", pointerup);
      host.removeEventListener("pointercancel", pointerup);
      scene.traverse((object) => {
        object.geometry?.dispose();
        if (object.material)
          for (const m of [].concat(object.material)) m.dispose();
      });
      environment.dispose();
      shadowTexture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
