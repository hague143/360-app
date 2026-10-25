import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  Plus,
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  Camera,
  UploadCloud,
  ImagePlus,
  Check,
  CheckCircle2,
  GripVertical,
  Trash2,
  ChevronUp,
  ChevronDown,
  Eye,
  Send,
  FileText,
  CarFront,
  MapPin,
  Info,
  Save,
  AlertTriangle,
  MapPinned,
  Link2,
  Download,
  Replace,
  RotateCw,
} from "lucide-react";
import { api, send, upload, photoUrl, money } from "./api";
import type { User, Listing, Vehicle, Area, Photo } from "./types";
import { Loading, ErrorBox, Badge, Modal } from "./ui";
import SpinStudio from "./SpinStudio";
const ModelViewer = lazy(() => import("./ModelViewer"));
export default function Dashboard({
  user,
  onAuth,
  path,
  navigate,
  catalog,
  areas,
  recommended,
}: {
  user: User | null;
  onAuth: () => void;
  path: string;
  navigate: (p: string) => void;
  catalog: Vehicle[];
  areas: Area[];
  recommended: string[];
}) {
  const [list, setList] = useState<Listing[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [page, setPage] = useState(1),
    [hasMore, setHasMore] = useState(false),
    [loadingMore, setLoadingMore] = useState(false);
  useEffect(() => {
    if (user && path === "/garage") {
      setLoading(true);
      api("/listings?mine=1")
        .then((r) => {
          setList(r.items);
          setPage(1);
          setHasMore(r.hasMore);
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [user, path]);
  if (!user)
    return (
      <div className="page signed-out">
        <span className="big-icon">
          <CarFront size={45} strokeWidth={1.2} />
        </span>
        <span className="eyebrow green">YOUR PERSONAL GARAGE</span>
        <h1>
          Good listings start
          <br />
          with the real details.
        </h1>
        <p>
          Sign in to add your car, organize its photos and share the full
          picture.
        </p>
        <button className="button primary" onClick={onAuth}>
          Sign in or create an account <ArrowRight size={17} />
        </button>
      </div>
    );
  if (path === "/garage/new")
    return (
      <div className="page editor-page">
        <button className="back-link" onClick={() => navigate("/garage")}>
          <ArrowLeft size={15} /> My garage
        </button>
        <div className="page-heading">
          <div>
            <span className="eyebrow green">LET’S START WITH YOUR CAR</span>
            <h1>Create your listing.</h1>
            <p className="muted-text">
              Your draft is private until you’re ready to publish.
            </p>
          </div>
          <span className="step-tag">
            01 <span>/ 03 · VEHICLE DETAILS</span>
          </span>
        </div>
        <VehicleForm
          catalog={catalog}
          onSave={(l) => navigate("/garage/" + l.id)}
        />
      </div>
    );
  if (path.startsWith("/garage/"))
    return (
      <Editor
        id={path.split("/")[2]}
        navigate={navigate}
        catalog={catalog}
        areas={areas}
        recommended={recommended}
      />
    );
  return (
    <div className="page garage-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow green">YOUR PERSONAL GARAGE</span>
          <h1>Hello, {user.name.split(" ")[0]}.</h1>
          <p className="muted-text">
            A home for your cars and all their details.
          </p>
        </div>
        <button
          className="button primary"
          onClick={() => navigate("/garage/new")}
        >
          <Plus size={17} /> Add a car
        </button>
      </div>
      <ErrorBox error={error} />
      {loading ? (
        <Loading />
      ) : list.length ? (
        <div className="garage-list">
          {list.map((l) => (
            <div className="garage-row" key={l.id}>
              <div className="garage-thumb">
                {l.photos[0] ? (
                  <img src={photoUrl(l.photos[0].id)} alt={l.title} />
                ) : (
                  <CarFront size={40} strokeWidth={1.2} />
                )}
              </div>
              <div>
                <Badge muted={l.status === "draft"}>
                  {l.status === "draft" ? "PRIVATE DRAFT" : "PUBLISHED"}
                </Badge>
                <h2>
                  {l.title} · {l.year}
                </h2>
                <p>
                  {l.city} · PKR {money(l.price)} · {l.photos.length} photos
                </p>
              </div>
              <div className="garage-row-actions">
                <small>
                  {l.coverage}/{l.recommended} areas photographed
                </small>
                <button
                  className="button"
                  onClick={() => navigate("/garage/" + l.id)}
                >
                  Manage listing <ArrowRight size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="garage-empty">
          <span className="big-icon">
            <CarFront size={50} strokeWidth={1} />
          </span>
          <h2>Your garage is a blank canvas.</h2>
          <p>Add your car and let the photos tell its story.</p>
          <button
            className="button primary"
            onClick={() => navigate("/garage/new")}
          >
            Create your first listing <Plus size={17} />
          </button>
        </div>
      )}
      {hasMore && !loading && (
        <button
          className="button"
          disabled={loadingMore}
          onClick={async () => {
            setLoadingMore(true);
            try {
              const r = await api(`/listings?mine=1&page=${page + 1}`);
              setList((prev) => [...prev, ...r.items]);
              setPage(page + 1);
              setHasMore(r.hasMore);
            } catch (e: any) {
              setError(e.message);
            } finally {
              setLoadingMore(false);
            }
          }}
        >
          {loadingMore ? "Loading…" : "Load more listings"}
        </button>
      )}
    </div>
  );
}
function VehicleForm({
  catalog,
  onSave,
  initial,
}: {
  catalog: Vehicle[];
  onSave: (l: Listing) => void;
  initial?: Listing;
}) {
  const [selected, setSelected] = useState(
      initial?.catalog_id || catalog[0]?.id || "",
    ),
    [make, setMake] = useState(initial?.vehicle.make || catalog[0]?.make || ""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const vehicle = catalog.find((c) => c.id === selected);
  return (
    <form
      className="vehicle-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        setBusy(true);
        const f = Object.fromEntries(new FormData(e.currentTarget));
        try {
          const l = await send(
            initial ? "/listings/" + initial.id : "/listings",
            {
              ...f,
              catalog_id: selected,
              unavailable: initial?.unavailable || [],
            },
            initial ? "PATCH" : "POST",
          );
          onSave(l);
        } catch (e: any) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-card">
        <div className="form-card-title">
          <CarFront size={21} />
          <div>
            <h2>Match the exact vehicle</h2>
            <p>Generation, trim and market make a difference.</p>
          </div>
        </div>
        <ErrorBox error={error} />
        <div className="form-grid">
          <label>
            Make
            <select
              aria-label="Make"
              value={make}
              disabled={!!initial}
              onChange={(e) => {
                setMake(e.target.value);
                setSelected(catalog.find((c) => c.make === e.target.value)!.id);
              }}
            >
              {[...new Set(catalog.map((c) => c.make))].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label>
            Model & variant
            <select
              aria-label="Model and variant"
              value={selected}
              disabled={!!initial}
              onChange={(e) => setSelected(e.target.value)}
            >
              {catalog
                .filter((c) => c.make === make)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.model} · {c.variant}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Model year
            <input
              name="year"
              type="number"
              key={selected}
              min={vehicle?.year_from}
              max={vehicle?.year_to}
              defaultValue={initial?.year || vehicle?.year_from}
              required
            />
          </label>
          <label>
            Generation / body shape
            <input value={vehicle?.generation || ""} readOnly />
          </label>
          <label>
            Facelift
            <input value={vehicle?.facelift || ""} readOnly />
          </label>
          <label>
            Market specification
            <input value={vehicle?.market || ""} readOnly />
          </label>
        </div>
        <div className="info-note">
          <Info size={18} />
          <p>
            {vehicle?.supported
              ? "An approved reference asset is available. New listings are pinned to its current version."
              : "3D model not yet supported. Your actual photos remain fully accessible through the parts and angles interface."}
          </p>
        </div>
      </div>
      <div className="form-card">
        <div className="form-card-title">
          <FileText size={21} />
          <div>
            <h2>The listing essentials</h2>
            <p>A few helpful details for your buyer.</p>
          </div>
        </div>
        <label>
          Listing title
          <input
            name="title"
            maxLength={120}
            required
            placeholder="e.g. Toyota Corolla Altis Grande"
            defaultValue={initial?.title}
          />
        </label>
        <div className="form-grid">
          <label>
            Asking price (PKR)
            <input
              name="price"
              type="number"
              min="1"
              max="1000000000"
              required
              placeholder="e.g. 6250000"
              defaultValue={initial?.price}
            />
          </label>
          <label>
            Mileage (km)
            <input
              name="mileage"
              type="number"
              min="0"
              max="3000000"
              required
              placeholder="e.g. 54000"
              defaultValue={initial?.mileage}
            />
          </label>
        </div>
        <label>
          City
          <input
            name="city"
            maxLength={80}
            required
            placeholder="e.g. Islamabad"
            defaultValue={initial?.city}
          />
        </label>
        <label>
          Description
          <textarea
            name="description"
            maxLength={5000}
            rows={4}
            required
            placeholder="Share what a buyer should know, including any known damage or limitations."
            defaultValue={initial?.description}
          />
        </label>
        <button className="button primary" disabled={busy}>
          {busy
            ? "Saving…"
            : initial
              ? "Save listing details"
              : "Save draft & add photos"}
          <ArrowRight size={16} />
        </button>
      </div>
    </form>
  );
}
function Editor({
  id,
  navigate,
  catalog,
  areas,
  recommended,
}: {
  id: string;
  navigate: (p: string) => void;
  catalog: Vehicle[];
  areas: Area[];
  recommended: string[];
}) {
  const [listing, setListing] = useState<Listing | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(-1),
    [tab, setTab] = useState("photos"),
    [editing, setEditing] = useState<Photo | null>(null),
    [published, setPublished] = useState(false),
    [marker, setMarker] = useState(false),
    [position, setPosition] = useState<number[] | null>(null),
    [dragged, setDragged] = useState(""),
    [notice, setNotice] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const refresh = () => api<Listing>("/listings/" + id).then(setListing);
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, [id]);
  const action = async (fn: () => Promise<any>) => {
    setError("");
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (!listing)
    return (
      <div className="page">
        <ErrorBox error={error} />
        {!error && <Loading />}
      </div>
    );
  const l = listing,
    allAreas = [
      ...areas,
      ...l.markers.map((m) => ({
        id: m.id,
        label: (m.damage ? "Seller-reported damage: " : "") + m.label,
        group: "details",
      })),
    ];
  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    const form = new FormData();
    Array.from(files).forEach((f) => form.append("photos", f));
    setError("");
    setProgress(0);
    try {
      setListing(
        await upload("/listings/" + id + "/photos", form, setProgress),
      );
      setNotice("Photos uploaded. Select each photo to confirm its labels.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setProgress(-1);
      if (file.current) file.current.value = "";
    }
  }
  const reorder = (from: string, to: string) => {
    const ids = l.photos.map((p) => p.id),
      a = ids.indexOf(from),
      b = ids.indexOf(to);
    if (a === b) return;
    ids.splice(b, 0, ids.splice(a, 1)[0]);
    action(() => send("/listings/" + id + "/reorder", { ids }));
  };
  return (
    <div className="page editor-page">
      <button className="back-link" onClick={() => navigate("/garage")}>
        <ArrowLeft size={15} /> My garage
      </button>
      <div className="page-heading">
        <div>
          <Badge muted={l.status === "draft"}>
            {l.status === "draft" ? "PRIVATE DRAFT" : "PUBLISHED"}
          </Badge>
          <h1>{l.title}</h1>
          <p className="muted-text">
            {l.year} · {l.vehicle.variant} · {l.city}
          </p>
        </div>
        <div className="button-row">
          <button className="button" onClick={() => navigate("/listing/" + id)}>
            <Eye size={16} /> Preview
          </button>
          {l.status === "published" ? (
            <button
              disabled={busy}
              className="button"
              onClick={() =>
                action(() => send("/listings/" + id + "/unpublish", {}))
              }
            >
              Unpublish
            </button>
          ) : (
            <button
              disabled={busy || progress >= 0}
              className="button primary"
              onClick={() =>
                action(async () => {
                  await send("/listings/" + id + "/publish", {});
                  setPublished(true);
                })
              }
            >
              <Send size={15} /> Publish listing
            </button>
          )}
        </div>
      </div>
      <ErrorBox error={error} />
      {notice && (
        <div className="success-note" role="status">
          <CheckCircle2 size={17} />
          {notice}
          <button className="text-button" onClick={() => setNotice("")}>
            Dismiss
          </button>
        </div>
      )}
      <div className="editor-progress">
        {["Vehicle details", "Photos & labels", "Preview & publish"].map(
          (s, i) => (
            <span key={s} className={i < 2 ? "active" : ""}>
              <b>{i === 0 ? <Check size={13} /> : i + 1}</b>
              {s}
            </span>
          ),
        )}
        <small>
          Photo coverage{" "}
          <strong>
            {l.coverage} / {l.recommended}
          </strong>
        </small>
      </div>
      <div className="spin-feature-banner">
        <RotateCw size={24} />
        <div>
          <strong>Turn your photos into a walk-around.</strong>
          <span>
            Upload a sequence taken around your car. Get a swipeable photo view
            automatically.
          </span>
        </div>
        <button className="button primary" onClick={() => setTab("spin")}>
          Create photo view <ArrowRight size={15} />
        </button>
      </div>
      <div className="area-tabs editor-tabs">
        <button
          className={tab === "spin" ? "active" : ""}
          onClick={() => setTab("spin")}
        >
          360 photo view {l.spin.confirmed && <Check size={13} />}
        </button>
        <button
          className={tab === "photos" ? "active" : ""}
          onClick={() => setTab("photos")}
        >
          Photos & labels <span>{l.photos.length}</span>
        </button>
        <button
          className={tab === "details" ? "active" : ""}
          onClick={() => setTab("details")}
        >
          Listing details
        </button>
        <button
          className={tab === "unavailable" ? "active" : ""}
          onClick={() => setTab("unavailable")}
        >
          Unavailable areas
        </button>
        <button
          className={tab === "markers" ? "active" : ""}
          onClick={() => setTab("markers")}
        >
          Detail markers
        </button>
      </div>
      {tab === "spin" ? (
        <SpinStudio listing={l} onChange={setListing} />
      ) : tab === "unavailable" ? (
        <UnavailableAreas
          listing={l}
          areas={areas}
          onSave={(updated) => {
            setListing(updated);
            setNotice("Unavailable areas saved.");
          }}
        />
      ) : tab === "details" ? (
        <VehicleForm
          catalog={catalog}
          initial={l}
          onSave={(updated) => {
            setListing(updated);
            setNotice("Details saved.");
          }}
        />
      ) : tab === "markers" ? (
        <div className="form-card">
          <h2>Details worth pointing out.</h2>
          <p className="muted-text">
            Add an optional detail or seller-reported damage point. Positions
            are pinned to the listing’s approved asset version.
          </p>
          {l.asset ? (
            <>
              <button
                className="button primary"
                onClick={() => {
                  setMarker(true);
                  setPosition(null);
                }}
              >
                <MapPinned size={16} /> Place a marker
              </button>
              {l.markers.map((m) => (
                <div className="marker-row" key={m.id}>
                  <span>
                    {m.damage ? "Seller-reported damage: " : ""}
                    {m.label} <small>· asset v{l.asset!.version}</small>
                  </span>
                  <button
                    className="icon-button"
                    aria-label={"Delete marker " + m.label}
                    onClick={() => {
                      if (
                        confirm(
                          "Delete this marker and its photo associations? The photos will be kept.",
                        )
                      )
                        action(() =>
                          api(`/listings/${id}/markers/${m.id}`, {
                            method: "DELETE",
                          }),
                        );
                    }}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
            </>
          ) : (
            <div className="info-note">
              <Info size={20} />
              <p>
                Custom 3D markers need an approved exact vehicle asset. Use
                standard part and angle labels for this vehicle in the meantime.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="photo-editor-layout">
          <div>
            <div
              className={`upload-zone ${progress >= 0 ? "uploading" : ""}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (progress < 0) uploadFiles(e.dataTransfer.files);
              }}
            >
              <span className="upload-icon">
                <UploadCloud size={30} strokeWidth={1.4} />
              </span>
              <h2>
                {progress >= 0
                  ? `Uploading your originals… ${progress}%`
                  : "The real picture starts here."}
              </h2>
              <p>Drop your actual car photographs here, or choose files.</p>
              <input
                ref={file}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hidden
                aria-label="Upload car photos"
                onChange={(e) => uploadFiles(e.target.files)}
              />
              <button
                className="button primary"
                disabled={progress >= 0}
                onClick={() => file.current?.click()}
              >
                <ImagePlus size={16} /> Choose photos
              </button>
              <small>
                JPEG, PNG or WebP · Up to 10 MB each · 6 at a time · 60 per
                listing
              </small>
              {progress >= 0 && <progress value={progress} max="100" />}
            </div>
            <div className="photo-grid-heading">
              <h2>
                Your photographs <span>{l.photos.length}</span>
              </h2>
              <small>
                <GripVertical size={13} /> Drag to reorder, or use the arrow
                buttons.
              </small>
            </div>
            <div className="seller-photo-grid">
              {l.photos.map((p, i) => (
                <div
                  className="editable-photo"
                  key={p.id}
                  draggable
                  onDragStart={() => setDragged(p.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    reorder(dragged, p.id);
                  }}
                >
                  <button
                    className="edit-photo-image"
                    onClick={() => setEditing(p)}
                  >
                    <img
                      src={photoUrl(p.id)}
                      alt={`Your upload ${i + 1}`}
                      loading="lazy"
                    />
                    <span className="photo-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="edit-photo-label">
                      Edit labels <ArrowUpRight size={14} />
                    </span>
                  </button>
                  <div className="photo-label-summary">
                    {p.areas.length ? (
                      <span>
                        <CheckCircle2 size={14} />
                        {p.areas.length}{" "}
                        {p.areas.length === 1 ? "area" : "areas"} confirmed
                      </span>
                    ) : (
                      <span className="needs-label">
                        <AlertTriangle size={14} /> Needs labels
                      </span>
                    )}
                    <p>
                      {p.areas
                        .map((id) => allAreas.find((a) => a.id === id)?.label)
                        .join(", ") || "Select photo to assign an area"}
                    </p>
                  </div>
                  <div className="editable-photo-actions">
                    <button
                      className="icon-button"
                      aria-label={`Move photo ${i + 1} up`}
                      disabled={i === 0 || busy}
                      onClick={() => reorder(p.id, l.photos[i - 1].id)}
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Move photo ${i + 1} down`}
                      disabled={i === l.photos.length - 1 || busy}
                      onClick={() => reorder(p.id, l.photos[i + 1].id)}
                    >
                      <ChevronDown size={16} />
                    </button>
                    <button
                      className="text-button"
                      onClick={() => setEditing(p)}
                    >
                      Edit labels
                    </button>
                    <button
                      className="icon-button delete-photo"
                      aria-label={`Delete photo ${i + 1}`}
                      disabled={busy}
                      onClick={() => {
                        if (
                          confirm(
                            p.areas.length > 1
                              ? `This photo is used by ${p.areas.length} areas. Delete it from all of them?`
                              : "Delete this photo and its original? This cannot be undone.",
                          )
                        )
                          action(() =>
                            api("/photos/" + p.id, { method: "DELETE" }),
                          );
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <aside className="capture-sidebar">
            <span className="eyebrow green">A HELPFUL LITTLE CHECKLIST</span>
            <h2>Every angle helps.</h2>
            <p>
              Use daylight, keep the full area in frame, and add close-ups of
              any damage. Don’t edit out imperfections.
            </p>
            <div className="checklist">
              {recommended.map((id) => {
                const a = areas.find((a) => a.id === id),
                  has = l.photos.some((p) => p.areas.includes(id));
                return (
                  <div className="checklist-item" key={id}>
                    <span
                      className={has ? "check-circle checked" : "check-circle"}
                    >
                      {has && <Check size={12} />}
                    </span>
                    <span>{a?.label}</span>
                    {!has && (
                      <label className="unavailable-label">
                        <input
                          type="checkbox"
                          checked={l.unavailable.includes(id)}
                          disabled={busy}
                          onChange={(e) => {
                            const unavailable = e.target.checked
                              ? [...l.unavailable, id]
                              : l.unavailable.filter((a) => a !== id);
                            action(() =>
                              send(
                                "/listings/" + l.id,
                                { ...l, unavailable },
                                "PATCH",
                              ),
                            );
                          }}
                        />{" "}
                        unavailable
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="info-note">
              <Info size={17} />
              <p>
                {l.coverage} of {l.recommended} recommended areas. This is photo
                coverage, not a condition score.
              </p>
            </div>
            <div className="originals-note">
              <CheckCircle2 size={17} />
              <span>
                Originals stay private and unaltered. Public display copies have
                GPS and EXIF metadata removed.
              </span>
            </div>
          </aside>
        </div>
      )}
      {editing && (
        <PhotoEditor
          photo={editing}
          areas={allAreas}
          onClose={() => setEditing(null)}
          onSave={() => {
            setEditing(null);
            refresh();
          }}
          onReplace={async (files) => {
            if (!files.length) return;
            const form = new FormData();
            form.append("photos", files[0]);
            const updated: Listing = await upload(
              "/listings/" + id + "/photos",
              form,
              () => {},
            );
            const replacement = updated.photos.find(
              (p) => !l.photos.some((old) => old.id === p.id),
            )!;
            await send(
              "/photos/" + replacement.id,
              { areas: editing.areas, note: editing.note },
              "PATCH",
            );
            const ids = l.photos.map((p) =>
              p.id === editing.id ? replacement.id : p.id,
            );
            await api("/photos/" + editing.id, { method: "DELETE" });
            await send("/listings/" + id + "/reorder", { ids });
            setEditing(null);
            await refresh();
          }}
        />
      )}
      {published && (
        <Modal
          title="Your listing is live."
          onClose={() => setPublished(false)}
        >
          <div className="publish-success">
            <CheckCircle2 size={48} />
            <p>
              Your original photos are now accessible through a structured
              inspection page.
            </p>
            <input
              aria-label="Shareable listing URL"
              readOnly
              value={location.origin + "/listing/" + id}
            />
            <button
              className="button primary"
              onClick={() => navigate("/listing/" + id)}
            >
              View published listing <ArrowUpRight size={16} />
            </button>
          </div>
        </Modal>
      )}
      {marker && l.asset && (
        <Modal
          title="Add a detail marker"
          wide
          onClose={() => setMarker(false)}
        >
          <div className="marker-view">
            <Suspense fallback={<Loading />}>
              <ModelViewer
                asset={l.asset}
                selected=""
                onSelect={() => {}}
                preset="angle_front_right"
                addMarker
                onPlaced={(p) => setPosition(p)}
              />
            </Suspense>
          </div>
          <p className="muted-text">
            {position
              ? `Point selected: ${position.map((n) => n.toFixed(2)).join(", ")} (asset-local coordinates)`
              : "Rotate the car, then tap a surface to place your marker."}
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              await action(async () => {
                await send("/listings/" + id + "/markers", {
                  label: form.get("label"),
                  damage: form.get("damage") === "on",
                  position,
                });
                setMarker(false);
              });
            }}
          >
            <label>
              Detail label
              <input
                name="label"
                required
                maxLength={100}
                placeholder="e.g. Scratch on rear quarter panel"
              />
            </label>
            <label className="checkbox-label">
              <input name="damage" type="checkbox" /> Seller-reported damage
            </label>
            <button className="button primary" disabled={!position || busy}>
              Save marker
            </button>
            <ErrorBox error={error} />
          </form>
        </Modal>
      )}
    </div>
  );
}
function PhotoEditor({
  photo,
  areas,
  onClose,
  onSave,
  onReplace,
}: {
  photo: Photo;
  areas: Area[];
  onClose: () => void;
  onSave: () => void;
  onReplace: (files: FileList) => Promise<void>;
}) {
  const [ids, setIds] = useState(photo.areas),
    [note, setNote] = useState(photo.note),
    [q, setQ] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal title="Give this photo a place." onClose={onClose} wide>
      <div className="photo-label-editor">
        <div>
          <img
            className="label-preview"
            src={photoUrl(photo.id, "display")}
            alt="Your original upload, display copy"
          />
          <p className="muted-text">
            One photo can belong to several areas. Confirm only what is actually
            visible.
          </p>
          <div className="button-row">
            <a
              className="button small"
              href={"/api/photos/" + photo.id + "/original"}
            >
              <Download size={14} /> Original
            </a>
            <label className="button small replace-label">
              <Replace size={14} /> Replace photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                disabled={busy}
                onChange={async (e) => {
                  if (
                    !e.target.files?.length ||
                    !confirm(
                      "Replace this original permanently? Saved labels will be retained. Unsaved changes will be discarded.",
                    )
                  )
                    return;
                  setBusy(true);
                  try {
                    await onReplace(e.target.files);
                  } catch (e: any) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </label>
          </div>
          <label>
            Seller note
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              placeholder="Optional details or damage description"
              rows={3}
            />
          </label>
        </div>
        <div>
          <label>
            Search parts & angles
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="e.g. right mirror"
            />
          </label>
          <div className="label-options">
            {areas
              .filter((a) => a.label.toLowerCase().includes(q.toLowerCase()))
              .map((a) => (
                <label
                  key={a.id}
                  className={`label-option ${ids.includes(a.id) ? "selected" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={ids.includes(a.id)}
                    onChange={(e) =>
                      setIds(
                        e.target.checked
                          ? [...ids, a.id]
                          : ids.filter((id) => id !== a.id),
                      )
                    }
                  />
                  <span>
                    {a.label}
                    <small>
                      {a.group === "angle"
                        ? "Viewing angle"
                        : a.group === "details"
                          ? "Custom detail"
                          : "Physical part / area"}
                    </small>
                  </span>
                </label>
              ))}
          </div>
        </div>
      </div>
      <ErrorBox error={error} />
      <div className="modal-actions">
        <span>{ids.length} areas selected</span>
        <button
          className="button primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await send("/photos/" + photo.id, { areas: ids, note }, "PATCH");
              onSave();
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Check size={16} />
          {busy ? "Saving…" : "Confirm labels & save"}
        </button>
      </div>
    </Modal>
  );
}

function UnavailableAreas({
  listing,
  areas,
  onSave,
}: {
  listing: Listing;
  areas: Area[];
  onSave: (l: Listing) => void;
}) {
  const [ids, setIds] = useState(listing.unavailable),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <section className="form-card">
      <h2>Be clear about what isn’t available.</h2>
      <p className="muted-text">
        Mark any area you cannot photograph. This does not imply its condition.
        Uploaded photos remain accessible even if an area is marked unavailable.
      </p>
      <div className="unavailable-grid">
        {areas.map((a) => (
          <label className="checkbox-label" key={a.id}>
            <input
              type="checkbox"
              checked={ids.includes(a.id)}
              onChange={(e) =>
                setIds(
                  e.target.checked
                    ? [...ids, a.id]
                    : ids.filter((id) => id !== a.id),
                )
              }
            />
            {a.label}
          </label>
        ))}
      </div>
      <ErrorBox error={error} />
      <button
        disabled={busy}
        className="button primary"
        onClick={async () => {
          setBusy(true);
          try {
            onSave(
              await send(
                "/listings/" + listing.id,
                { ...listing, unavailable: ids },
                "PATCH",
              ),
            );
          } catch (e: any) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Save size={16} />
        {busy ? "Saving…" : "Save unavailable areas"}
      </button>
    </section>
  );
}
