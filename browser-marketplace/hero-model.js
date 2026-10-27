// Viewer for the actual user-supplied Koenigsegg mesh. The car is never
// synthesized from primitives and no external model, texture or decoder loads.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export function mount(
  host,
  { base64, playing = true, onReady = () => {}, onError = () => {} } = {},
) {
  let renderer,
    disposed = false,
    model = null,
    frame = null,
    visible = true,
    environment = null,
    controls = null,
    shadowTexture = null;
  const disposables = [];
  const scene = new THREE.Scene();
  function disposeObject(object) {
    object.traverse((node) => {
      node.geometry?.dispose();
      if (node.material)
        for (const mat of [].concat(node.material)) {
          for (const value of Object.values(mat))
            if (value?.isTexture) value.dispose();
          mat.dispose();
        }
    });
  }
  function fail(error) {
    if (disposed) return;
    host.dataset.render = "fallback";
    onError(error);
  }
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.className = "model-canvas";
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute(
      "aria-label",
      "Interactive Koenigsegg Agera 3D model",
    );
    renderer.domElement.addEventListener("webglcontextlost", (event) => {
      if (disposed) return;
      event.preventDefault();
      fail(new Error("3D rendering paused. Reload to try again."));
    });
    host.append(renderer.domElement);
    const pmrem = new THREE.PMREMGenerator(renderer),
      room = new RoomEnvironment();
    environment = pmrem.fromScene(room, 0.04);
    scene.environment = environment.texture;
    room.dispose();
    pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xece8ff, 0x20152c, 1.3));
    for (const [color, intensity, x, y, z] of [
      [0xffffff, 2.8, 4, 7, 5],
      [0xbd8aff, 1.2, -5, 3, -4],
      [0xffa6d8, 0.8, 5, 3, -5],
    ]) {
      const light = new THREE.DirectionalLight(color, intensity);
      light.position.set(x, y, z);
      scene.add(light);
    }
  } catch (error) {
    renderer?.dispose();
    fail(error);
    return {
      dispose() {},
      setPlaying() {},
      reset() {},
      zoom() {},
      capture() {
        return null;
      },
    };
  }
  const camera = new THREE.PerspectiveCamera(31, 1, 0.05, 100);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.autoRotate = playing;
  controls.autoRotateSpeed = 1.15;
  controls.minPolarAngle = 0.28;
  controls.maxPolarAngle = Math.PI / 2 - 0.025;
  controls.enableZoom = true;
  controls.zoomSpeed = 0.7;
  let fitDistance = 8,
    targetHeight = 1,
    previous = 0,
    lastDraw = 0;
  function fit() {
    camera.position.set(
      fitDistance * 0.65,
      targetHeight + fitDistance * 0.29,
      fitDistance * 0.76,
    );
    controls.target.set(0, targetHeight, 0);
    camera.updateProjectionMatrix();
    controls.update();
    draw();
  }
  function draw() {
    if (disposed || !renderer) return;
    renderer.render(scene, camera);
    host.dataset.azimuth = controls.getAzimuthalAngle().toFixed(4);
    host.dataset.distance = camera.position
      .distanceTo(controls.target)
      .toFixed(3);
  }
  function resize() {
    if (disposed) return;
    const width = host.clientWidth,
      height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    draw();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  const intersection = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
  });
  intersection.observe(host);
  function tick(now) {
    if (disposed) return;
    frame = requestAnimationFrame(tick);
    if (document.hidden || !visible) {
      previous = now;
      return;
    }
    if (now - lastDraw < 32) return;
    const delta = Math.min((now - previous) / 1000, 0.08);
    previous = now;
    lastDraw = now;
    controls.update(delta);
    draw();
  }
  function key(event) {
    if (event.key === "0") {
      event.preventDefault();
      fit();
    }
    if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      const offset = camera.position.clone().sub(controls.target);
      offset.applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        event.key === "ArrowLeft" ? -0.15 : 0.15,
      );
      camera.position.copy(controls.target).add(offset);
      controls.update();
      draw();
    }
  }
  host.addEventListener("keydown", key);
  resize();
  fit();
  frame = requestAnimationFrame(tick);
  try {
    const raw = atob(base64),
      bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    new GLTFLoader().parse(
      bytes.buffer,
      "",
      (gltf) => {
        if (disposed) {
          disposeObject(gltf.scene);
          return;
        }
        model = gltf.scene;
        const bounds = new THREE.Box3().setFromObject(model),
          size = bounds.getSize(new THREE.Vector3()),
          center = bounds.getCenter(new THREE.Vector3());
        if (!Number.isFinite(size.length()) || size.length() === 0) {
          fail(new Error("The model geometry could not be displayed."));
          return;
        }
        const scale = 5 / Math.max(size.x, size.z);
        model.scale.multiplyScalar(scale);
        model.position.set(
          -center.x * scale,
          -bounds.min.y * scale,
          -center.z * scale,
        );
        scene.add(model);
        const normalized = new THREE.Box3().setFromObject(model),
          dimensions = normalized.getSize(new THREE.Vector3());
        targetHeight = dimensions.y * 0.46;
        const radius = Math.hypot(
          dimensions.x / 2,
          dimensions.y / 2,
          dimensions.z / 2,
        );
        const halfVertical = THREE.MathUtils.degToRad(camera.fov / 2);
        const halfHorizontal = Math.atan(
          Math.tan(halfVertical) * camera.aspect,
        );
        const planarRadius = Math.hypot(dimensions.x, dimensions.z) / 2;
        fitDistance =
          Math.max(
            planarRadius / Math.sin(halfHorizontal),
            (dimensions.y * 0.65 + planarRadius * 0.3) / Math.sin(halfVertical),
          ) * 1.08;
        controls.minDistance = Math.max(2.4, fitDistance * 0.35);
        controls.maxDistance = fitDistance * 1.7;
        // A local soft contact shadow is decorative; all vehicle geometry is from GLB.
        const canvas = document.createElement("canvas");
        canvas.width = 128;
        canvas.height = 128;
        const context = canvas.getContext("2d"),
          gradient = context.createRadialGradient(64, 64, 6, 64, 64, 64);
        gradient.addColorStop(0, "#000000a0");
        gradient.addColorStop(1, "#00000000");
        context.fillStyle = gradient;
        context.fillRect(0, 0, 128, 128);
        shadowTexture = new THREE.CanvasTexture(canvas);
        const shadow = new THREE.Mesh(
          new THREE.PlaneGeometry(dimensions.x * 1.4, dimensions.z * 1.4),
          new THREE.MeshBasicMaterial({
            map: shadowTexture,
            transparent: true,
            depthWrite: false,
          }),
        );
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = -0.015;
        scene.add(shadow);
        disposables.push(shadow);
        fit();
        host.dataset.render = "model";
        let meshCount = 0;
        gltf.scene.traverse((node) => {
          if (node.isMesh) meshCount++;
        });
        host.dataset.meshes = String(meshCount);
        onReady({ size: dimensions.toArray() });
      },
      (error) => {
        if (!disposed) fail(error);
      },
    );
  } catch (error) {
    fail(error);
  }
  return {
    setPlaying(value) {
      if (controls) {
        controls.autoRotate = value;
        if (!value) {
          controls.enableDamping = false;
          controls.update();
          controls.enableDamping = true;
          draw();
        }
      }
    },
    reset() {
      fit();
    },
    zoom(factor) {
      const offset = camera.position.clone().sub(controls.target);
      offset.multiplyScalar(factor);
      offset.clampLength(controls.minDistance, controls.maxDistance);
      camera.position.copy(controls.target).add(offset);
      controls.update();
      draw();
    },
    capture() {
      draw();
      return renderer.domElement.toDataURL("image/png");
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
      host.removeEventListener("keydown", key);
      controls?.dispose();
      if (model) disposeObject(model);
      for (const object of disposables) disposeObject(object);
      environment?.dispose();
      shadowTexture?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
