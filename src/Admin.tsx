import { lazy, Suspense, useEffect, useState } from "react";
import {
  Plus,
  UploadCloud,
  ShieldCheck,
  Box,
  CheckCircle2,
  Eye,
  ArrowRight,
  Info,
  Save,
  Pencil,
} from "lucide-react";
import { api, send, upload } from "./api";
import type { Asset, Vehicle, User } from "./types";
import { Modal, ErrorBox, Loading, Badge } from "./ui";
const ModelViewer = lazy(() => import("./ModelViewer"));
const exampleConfig = {
  scale: 1,
  rotation: [0, 0, 0],
  target: [0, 0, 0],
  hotspots: [
    { area: "mirror_right", position: [1, 0.7, 0.8], normal: [1, 0, 0] },
    { area: "engine_bay", position: [0, 0.8, 1.5], normal: [0, 1, 0] },
    { area: "boot_interior", position: [0, 0.7, -1.5], normal: [0, 1, 0] },
    { area: "angle_rear_right", position: [1, 0.7, -1.5], normal: [1, 0, -1] },
  ],
  meshes: {},
  cameras: {},
};
export default function Admin({
  catalog,
  user,
  onCatalog,
}: {
  catalog: Vehicle[];
  user: User | null;
  onCatalog: () => void;
}) {
  const [assets, setAssets] = useState<Asset[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(-1),
    [preview, setPreview] = useState<Asset | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [vehicle, setVehicle] = useState<Vehicle | "new" | null>(null),
    [tab, setTab] = useState("assets");
  const refresh = () => api<Asset[]>("/admin/assets").then(setAssets);
  useEffect(() => {
    if (user?.role === "admin") refresh().catch((e) => setError(e.message));
  }, [user]);
  if (user?.role !== "admin")
    return (
      <div className="page signed-out">
        <ShieldCheck size={40} />
        <h1>Administrator access required.</h1>
        <p>
          Sign in with an administrator account to manage the vehicle catalog
          and approved assets.
        </p>
      </div>
    );
  return (
    <div className="page admin-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow green">ASSET & CATALOG STUDIO</span>
          <h1>The right car. Every time.</h1>
          <p className="muted-text">
            Verify compatibility and licensing before making a reference model
            available.
          </p>
        </div>
        <Badge>
          <ShieldCheck size={13} /> ADMINISTRATOR
        </Badge>
      </div>
      <ErrorBox error={error} />
      <div className="area-tabs">
        <button
          className={tab === "assets" ? "active" : ""}
          onClick={() => setTab("assets")}
        >
          3D assets & versions
        </button>
        <button
          className={tab === "catalog" ? "active" : ""}
          onClick={() => setTab("catalog")}
        >
          Vehicle catalog
        </button>
      </div>
      {tab === "catalog" ? (
        <>
          <button className="button primary" onClick={() => setVehicle("new")}>
            <Plus size={16} /> Add catalog entry
          </button>
          <div className="catalog-list">
            {catalog.map((c) => (
              <div className="catalog-row" key={c.id}>
                <div>
                  <strong>
                    {c.make} {c.model}
                  </strong>
                  <p>
                    {c.generation} · {c.year_from}–{c.year_to}
                  </p>
                  <small>
                    {c.variant} · {c.facelift} · {c.market}
                  </small>
                </div>
                <Badge muted={!c.supported}>
                  {c.supported ? "APPROVED ASSET" : "3D UNSUPPORTED"}
                </Badge>
                <button
                  className="icon-button"
                  aria-label={"Edit " + c.make + " " + c.model}
                  onClick={() => setVehicle(c)}
                >
                  <Pencil size={17} />
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="admin-grid">
          <form
            className="form-card"
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              setBusy(true);
              setProgress(0);
              const form = e.currentTarget;
              try {
                await upload("/admin/assets", new FormData(form), setProgress);
                form.reset();
                await refresh();
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
                setProgress(-1);
              }
            }}
          >
            <div className="form-card-title">
              <Box size={22} />
              <div>
                <h2>Import a reference asset</h2>
                <p>Imports are unapproved until tested and confirmed.</p>
              </div>
            </div>
            <label>
              Exact catalog match
              <select
                name="catalog_id"
                aria-label="Exact catalog match"
                required
              >
                {catalog.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.make} {c.model} · {c.generation} · {c.variant}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Self-contained GLB · max 25 MB
              <input name="asset" type="file" accept=".glb" required />
            </label>
            <div className="form-grid">
              <label>
                Source URL
                <input
                  name="source_url"
                  type="url"
                  required
                  placeholder="https://…"
                />
              </label>
              <label>
                Creator
                <input name="creator" required maxLength={200} />
              </label>
            </div>
            <label>
              License & commercial web usage rights
              <input
                name="license"
                required
                maxLength={1000}
                placeholder="License name and version; include usage limitations"
              />
            </label>
            <label>
              Required attribution
              <input
                name="attribution"
                required
                maxLength={1000}
                placeholder="Exact attribution, or ‘No attribution required’"
              />
            </label>
            <label>
              Compatibility / known limitations
              <textarea
                name="limitations"
                required
                maxLength={2000}
                rows={3}
                placeholder="Confirm Pakistani trim, body shape, facelift and supported years. Record any visible differences."
              />
            </label>
            <label>
              Versioned geometry & hotspot configuration
              <textarea
                className="code-input"
                name="config"
                defaultValue={JSON.stringify(exampleConfig, null, 2)}
                rows={12}
                required
              />
            </label>
            <p className="help-text">
              Coordinates: X = occupant’s right, Y = up, Z = front. Transform
              the reference model to match this convention. Supply outward
              normals for occlusion. Example positions must be calibrated to the
              actual model.
            </p>
            <ErrorBox error={error} />
            <button className="button primary" disabled={busy}>
              <UploadCloud size={16} />
              {busy ? `Uploading ${progress}%` : "Import as unapproved version"}
            </button>
          </form>
          <section>
            <h2 className="asset-list-title">
              Asset registry <span>{assets.length}</span>
            </h2>
            {!assets.length && (
              <div className="asset-empty">
                <Box size={45} strokeWidth={1} />
                <h3>No approved shortcuts.</h3>
                <p>
                  No licensed exact-model assets have been imported. Unsupported
                  vehicles use the structured photo interface.
                </p>
              </div>
            )}
            {assets.map((a) => {
              const c = catalog.find((c) => c.id === a.catalog_id);
              return (
                <div className="asset-card" key={a.id}>
                  <div>
                    <Badge muted={!a.approved}>
                      {a.approved ? "APPROVED" : "NEEDS VERIFICATION"}
                    </Badge>
                    <span className="version-tag">v{a.version}</span>
                  </div>
                  <h3>
                    {c?.make} {c?.model}
                  </h3>
                  <p>
                    {c?.generation} · {c?.variant}
                  </p>
                  <dl>
                    <dt>Creator</dt>
                    <dd>{a.creator}</dd>
                    <dt>License</dt>
                    <dd>{a.license}</dd>
                    <dt>Format / size</dt>
                    <dd>GLB 2.0 / {(a.size / 1024 / 1024).toFixed(2)} MB</dd>
                  </dl>
                  <button
                    className="button full"
                    onClick={() => {
                      setPreview(a);
                      setConfirmed(false);
                    }}
                  >
                    <Eye size={16} /> Preview & verify
                  </button>
                </div>
              );
            })}
            <div className="info-note">
              <Info size={18} />
              <p>
                Asset versions are immutable. Existing listings stay pinned to
                their original version. New approvals apply to new listings
                only.
              </p>
            </div>
          </section>
        </div>
      )}
      {preview && (
        <Modal
          title={`Verify asset · version ${preview.version}`}
          wide
          onClose={() => setPreview(null)}
        >
          <div className="asset-preview">
            <Suspense fallback={<Loading />}>
              <ModelViewer
                asset={preview}
                selected="mirror_right"
                onSelect={() => {}}
                preset="angle_front_right"
              />
            </Suspense>
          </div>
          <dl className="preview-details">
            <dt>Source</dt>
            <dd>
              <a href={preview.source_url} target="_blank" rel="noreferrer">
                {preview.source_url}
              </a>
            </dd>
            <dt>Rights & attribution</dt>
            <dd>
              {preview.license} · {preview.attribution}
            </dd>
            <dt>Compatibility / limitations</dt>
            <dd>{preview.limitations}</dd>
          </dl>
          {!preview.approved && (
            <>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>
                  I tested rotation, mesh / hotspot positions and occlusion;
                  verified the exact Pakistani geometry and compatible years /
                  trim; and confirmed commercial web distribution rights and
                  attribution.
                </span>
              </label>
              <ErrorBox error={error} />
              <button
                className="button primary"
                disabled={!confirmed || busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await send("/admin/assets/" + preview.id + "/approve", {
                      confirmed: true,
                    });
                    setPreview(null);
                    await refresh();
                    onCatalog();
                  } catch (e: any) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <ShieldCheck size={16} /> Approve this version
              </button>
            </>
          )}
        </Modal>
      )}
      {vehicle && (
        <Modal
          title={
            vehicle === "new"
              ? "Add exact vehicle identity"
              : "Edit vehicle identity"
          }
          onClose={() => setVehicle(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              setBusy(true);
              try {
                await send(
                  "/admin/catalog" +
                    (vehicle === "new" ? "" : "/" + vehicle.id),
                  Object.fromEntries(new FormData(e.currentTarget)),
                  vehicle === "new" ? "POST" : "PATCH",
                );
                onCatalog();
                setVehicle(null);
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="form-grid">
              {[
                ["make", "Make"],
                ["model", "Model"],
                ["generation", "Generation / body shape"],
                ["facelift", "Facelift"],
                ["variant", "Visible variant / trim"],
                ["market", "Market specification"],
                ["year_from", "From year"],
                ["year_to", "To year"],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    name={key}
                    type={key.startsWith("year") ? "number" : "text"}
                    required
                    defaultValue={
                      vehicle === "new" ? "" : (vehicle as any)[key]
                    }
                  />
                </label>
              ))}
            </div>
            <p className="help-text">
              Used identities cannot be rewritten; create a new entry to
              preserve existing listings.
            </p>
            <ErrorBox error={error} />
            <button className="button primary" disabled={busy}>
              <Save size={16} /> Save catalog entry
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
