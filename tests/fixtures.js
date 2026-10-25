// Test-only geometric fixtures. These are not car photographs or approved vehicle models.
export function triangleGlb() {
  const bin = Buffer.alloc(36);
  [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((v, i) => bin.writeFloatLE(v, i * 4));
  const model = {
    asset: { version: "2.0", generator: "CarView TEST fixture — NOT a car" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: "test_triangle" }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    buffers: [{ byteLength: 36 }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        min: [0, 0, 0],
        max: [1, 1, 0],
      },
    ],
  };
  const raw = JSON.stringify(model),
    json = Buffer.from(
      raw + " ".repeat((4 - (Buffer.byteLength(raw) % 4)) % 4),
    ),
    out = Buffer.alloc(28 + json.length + bin.length);
  out.writeUInt32LE(0x46546c67, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(json.length, 12);
  out.writeUInt32LE(0x4e4f534a, 16);
  json.copy(out, 20);
  out.writeUInt32LE(bin.length, 20 + json.length);
  out.writeUInt32LE(0x004e4942, 24 + json.length);
  bin.copy(out, 28 + json.length);
  return out;
}
export const testConfig = {
  scale: 1,
  rotation: [0, 0, 0],
  target: [0, 0, 0],
  hotspots: [
    { area: "mirror_right", position: [0.2, 0.2, 0], normal: [0, 0, 1] },
  ],
  meshes: { test_triangle: "mirror_right" },
  cameras: { angle_front: [0, 0, 6] },
};
