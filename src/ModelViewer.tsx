import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Asset, Marker } from "./types";
const presets: Record<string, number[]> = {
  angle_front: [0, 1.5, 6],
  angle_rear: [0, 1.5, -6],
  angle_left: [-6, 1.5, 0],
  angle_right: [6, 1.5, 0],
  angle_front_left: [-4.5, 2.5, 4.5],
  angle_front_right: [4.5, 2.5, 4.5],
  angle_rear_left: [-4.5, 2.5, -4.5],
  angle_rear_right: [4.5, 2.5, -4.5],
  angle_top: [0, 7, 0.01],
};
export default function ModelViewer({
  asset,
  selected,
  onSelect,
  preset,
  resetKey = 0,
  availableAreas = [],
  markers = [],
  addMarker,
  onPlaced,
}: {
  asset: Asset;
  selected: string;
  onSelect: (id: string) => void;
  preset: string;
  resetKey?: number;
  availableAreas?: string[];
  markers?: Marker[];
  addMarker?: boolean;
  onPlaced?: (p: number[]) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    selectedRef = useRef(selected),
    selectRef = useRef(onSelect),
    placeRef = useRef(onPlaced),
    addRef = useRef(addMarker),
    availableRef = useRef(availableAreas),
    cameraFn = useRef<(p: string) => void>(() => {});
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [progress, setProgress] = useState(0);
  selectedRef.current = selected;
  selectRef.current = onSelect;
  placeRef.current = onPlaced;
  addRef.current = addMarker;
  availableRef.current = availableAreas;
  useEffect(() => {
    cameraFn.current(preset);
  }, [preset, resetKey]);
  useEffect(() => {
    const container = host.current!;
    let stopped = false,
      frame = 0,
      renderer: THREE.WebGLRenderer | undefined,
      controls: OrbitControls | undefined,
      root: THREE.Group | undefined;
    const disposables: THREE.Object3D[] = [];
    setError("");
    setLoading(true);
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setClearColor(0xeaf0ec, 1);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      container.appendChild(renderer.domElement);
      const scene = new THREE.Scene(),
        camera = new THREE.PerspectiveCamera(38, 1, 0.01, 10000);
      camera.position.set(5, 3, 5);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x7f9689, 3));
      const light = new THREE.DirectionalLight(0xffffff, 3);
      light.position.set(5, 9, 5);
      scene.add(light);
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.enablePan = false;
      controls.minDistance = 2;
      controls.maxDistance = 14;
      cameraFn.current = (p) => {
        // Flush OrbitControls' residual momentum before applying an explicit preset.
        controls!.enableDamping = false;
        controls!.update();
        const target = new THREE.Vector3(...asset.config.target);
        controls!.target.copy(target);
        camera.position
          .fromArray(presets[p] || presets.angle_front_right)
          .add(target);
        if (asset.config.cameras?.[p])
          camera.position.fromArray(asset.config.cameras[p]);
        controls!.update();
        controls!.enableDamping = true;
      };
      cameraFn.current(preset);
      const ray = new THREE.Raycaster(),
        pointer = new THREE.Vector2(),
        v = new THREE.Vector3();
      const spots: {
        id: string;
        pos: THREE.Vector3;
        normal?: THREE.Vector3;
        el: HTMLButtonElement;
      }[] = [];
      const resize = () => {
        if (!renderer) return;
        const w = container.clientWidth,
          h = container.clientHeight;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(resize);
      observer.observe(container);
      resize();
      let start = [0, 0],
        moved = false;
      const down = (e: PointerEvent) => {
        start = [e.clientX, e.clientY];
        moved = false;
      };
      const move = (e: PointerEvent) => {
        if (Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 8)
          moved = true;
      };
      const click = (e: MouseEvent) => {
        if (moved || !root) return;
        const rect = renderer!.domElement.getBoundingClientRect();
        pointer.set(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          (-(e.clientY - rect.top) / rect.height) * 2 + 1,
        );
        ray.setFromCamera(pointer, camera);
        const hit = ray.intersectObject(root, true)[0];
        if (!hit) return;
        if (addRef.current) {
          const local = root.worldToLocal(hit.point.clone());
          placeRef.current?.(local.toArray());
          return;
        }
        let obj: THREE.Object3D | null = hit.object;
        while (obj) {
          const id = asset.config.meshes?.[obj.name];
          if (id) {
            selectRef.current(id);
            return;
          }
          obj = obj.parent;
        }
      };
      renderer.domElement.addEventListener("pointerdown", down);
      renderer.domElement.addEventListener("pointermove", move);
      renderer.domElement.addEventListener("click", click);
      new GLTFLoader().load(
        `/media/assets/${asset.id}`,
        (gltf) => {
          if (stopped) {
            gltf.scene.traverse((o) => {
              const m = o as THREE.Mesh;
              m.geometry?.dispose();
              if (m.material)
                (Array.isArray(m.material) ? m.material : [m.material]).forEach(
                  (x) => x.dispose(),
                );
            });
            return;
          }
          root = gltf.scene;
          root.scale.setScalar(asset.config.scale);
          root.rotation.set(...asset.config.rotation);
          scene.add(root);
          disposables.push(root);
          root.updateMatrixWorld(true);
          const configs = [
            ...asset.config.hotspots.map((h) => ({
              id: h.area,
              pos: h.position,
              normal: h.normal,
            })),
            ...markers
              .filter((m) => m.asset_id === asset.id)
              .map((m) => ({ id: m.id, pos: m.position, normal: undefined })),
          ];
          for (const h of configs) {
            const el = document.createElement("button");
            el.className = "model-hotspot";
            el.setAttribute("aria-label", h.id.replaceAll("_", " "));
            el.title = h.id.replaceAll("_", " ");
            el.onclick = () => selectRef.current(h.id);
            container.appendChild(el);
            spots.push({
              id: h.id,
              pos: new THREE.Vector3(...h.pos),
              normal: h.normal ? new THREE.Vector3(...h.normal) : undefined,
              el,
            });
          }
          setLoading(false);
        },
        (e) =>
          setProgress(e.total ? Math.round((e.loaded / e.total) * 100) : 0),
        () => {
          if (!stopped) {
            setError(
              "The model could not load. Use the area list to view photos.",
            );
            setLoading(false);
          }
        },
      );
      const draw = () => {
        if (stopped) return;
        frame = requestAnimationFrame(draw);
        controls!.update();
        if (root) {
          root.updateMatrixWorld(true);
          for (const s of spots) {
            const world = root.localToWorld(s.pos.clone()),
              dir = camera.position.clone().sub(world),
              dist = dir.length();
            let visible =
              !s.normal ||
              s.normal.clone().transformDirection(root.matrixWorld).dot(dir) >
                0;
            ray.set(
              camera.position,
              world.clone().sub(camera.position).normalize(),
            );
            const hits = ray.intersectObject(root, true);
            if (hits.length && hits[0].distance < dist - 0.08) visible = false;
            v.copy(world).project(camera);
            visible = visible && v.z < 1 && v.z > -1;
            s.el.style.display = visible ? "block" : "none";
            s.el.style.left = `${((v.x + 1) / 2) * container.clientWidth}px`;
            s.el.style.top = `${((-v.y + 1) / 2) * container.clientHeight}px`;
            s.el.classList.toggle("selected", s.id === selectedRef.current);
            s.el.classList.toggle(
              "has-photo",
              availableRef.current.includes(s.id),
            );
          }
          root.traverse((o) => {
            const mesh = o as THREE.Mesh;
            const area = asset.config.meshes?.[o.name];
            if (area && mesh.material)
              for (const mat of Array.isArray(mesh.material)
                ? mesh.material
                : [mesh.material]) {
                if ("emissive" in mat) {
                  const m = mat as THREE.MeshStandardMaterial;
                  if (!m.userData.originalEmissive)
                    m.userData.originalEmissive = m.emissive.clone();
                  m.emissive.copy(
                    area === selectedRef.current
                      ? new THREE.Color(0x176b57)
                      : m.userData.originalEmissive,
                  );
                }
              }
          });
        }
        container.dataset.camera = camera.position
          .toArray()
          .map((n) => n.toFixed(3))
          .join(",");
        renderer!.render(scene, camera);
      };
      draw();
      return () => {
        stopped = true;
        cancelAnimationFrame(frame);
        observer.disconnect();
        controls?.dispose();
        spots.forEach((s) => s.el.remove());
        disposables.forEach((obj) =>
          obj.traverse((o) => {
            const m = o as THREE.Mesh;
            m.geometry?.dispose();
            if (m.material)
              (Array.isArray(m.material) ? m.material : [m.material]).forEach(
                (mat) => {
                  for (const val of Object.values(mat))
                    if (val instanceof THREE.Texture) val.dispose();
                  mat.dispose();
                },
              );
          }),
        );
        renderer?.dispose();
        renderer?.domElement.remove();
      };
    } catch {
      setError(
        "WebGL is unavailable. Your photos are still accessible in the area list.",
      );
      setLoading(false);
      renderer?.dispose();
    }
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      controls?.dispose();
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, [asset.id]);
  return (
    <div className="model-container" ref={host}>
      {loading && (
        <div className="model-status">
          <span className="spinner" /> Loading reference model{" "}
          {progress > 0 ? `${progress}%` : ""}
        </div>
      )}
      {error && (
        <div className="model-status error">
          {error}
          <button className="text-button" onClick={() => location.reload()}>
            Retry model
          </button>
        </div>
      )}
      <div className="model-disclaimer">
        Reference 3D model — tap a part to view actual seller photos.
      </div>
      {addMarker && (
        <div className="placing-banner">
          Tap a surface to place your detail marker
        </div>
      )}
    </div>
  );
}
