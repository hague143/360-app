import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowRight,
  MapPin,
  Gauge,
  CalendarDays,
  ChevronRight,
  Camera,
  Images,
  Search,
  RotateCcw,
  Maximize2,
  X,
  Plus,
  Minus,
  Check,
  Link2,
  Info,
  Box,
  MousePointer2,
  Move,
  Layers,
  ShieldCheck,
  SlidersHorizontal,
  ChevronDown,
  ChevronLeft,
  AlertTriangle,
  Download,
} from "lucide-react";
import { api, money, photoUrl } from "./api";
import type { Listing, Area, Photo } from "./types";
import Schematic from "./Schematic";
import PhotoSpin from "./PhotoSpin";
import { Loading, ErrorBox, Badge, Modal } from "./ui";
const ModelViewer = lazy(() => import("./ModelViewer"));
const shortPresets = [
  ["angle_front", "Front"],
  ["angle_rear", "Rear"],
  ["angle_left", "Left"],
  ["angle_right", "Right"],
  ["angle_front_left", "Front-left"],
  ["angle_front_right", "Front-right"],
  ["angle_rear_left", "Rear-left"],
  ["angle_rear_right", "Rear-right"],
  ["angle_top", "Top"],
  ["underbody", "Underside"],
  ["engine_bay", "Engine"],
  ["boot_interior", "Boot"],
  ["dashboard", "Interior"],
];
export default function Inspection({
  id,
  areas,
  recommended,
  navigate,
  sell,
}: {
  id: string;
  areas: Area[];
  recommended: string[];
  navigate: (p: string) => void;
  sell: () => void;
}) {
  const [listing, setListing] = useState<Listing | null>(null),
    [error, setError] = useState(""),
    [selected, setSelected] = useState("angle_front_right"),
    [tab, setTab] = useState("angle"),
    [query, setQuery] = useState(""),
    [lightbox, setLightbox] = useState<Photo | null>(null),
    [preset, setPreset] = useState("angle_front_right"),
    [view, setView] = useState("map"),
    [shared, setShared] = useState(false),
    [full, setFull] = useState(false),
    [resetKey, setResetKey] = useState(0),
    [mobilePhotos, setMobilePhotos] = useState(false);
  useEffect(() => {
    setListing(null);
    setError("");
    api<Listing>("/listings/" + id)
      .then((l) => {
        setListing(l);
        setView(l.spin.confirmed || l.demo ? "spin" : l.asset ? "3d" : "map");
      })
      .catch((e) => setError(e.message));
  }, [id]);
  function select(id: string) {
    if (view === "spin") setView(l?.asset ? "3d" : "map");
    setSelected(id);
    setMobilePhotos(true);
    if (id.startsWith("angle_") && id !== "angle_underbody") {
      setPreset(id);
      setResetKey((k) => k + 1);
    }
  }
  if (error)
    return (
      <div className="page">
        <ErrorBox error={error} />
        <button className="button" onClick={() => navigate("/explore")}>
          Back to listings
        </button>
      </div>
    );
  if (!listing) return <Loading />;
  const l = listing,
    allAreas = [
      ...areas,
      ...l.markers.map((m) => ({ id: m.id, label: m.label, group: "details" })),
    ],
    area = allAreas.find((a) => a.id === selected),
    photos = l.photos.filter((p) => p.areas.includes(selected)),
    damage = l.markers.find((m) => m.id === selected)?.damage;
  const viewer = (
    <>
      {view === "spin" ? (
        <PhotoSpin
          photos={
            l.spin.confirmed
              ? l.spin.ids
                  .map((id) => l.photos.find((p) => p.id === id))
                  .filter((p) => !!p)
              : []
          }
          confirmed={l.spin.confirmed}
          loop={l.spin.loop}
          onUpload={sell}
          resetKey={resetKey}
        />
      ) : view === "3d" && l.asset ? (
        <Suspense fallback={<Loading />}>
          <ModelViewer
            asset={l.asset}
            selected={selected}
            onSelect={select}
            preset={preset}
            resetKey={resetKey}
            availableAreas={l.photos.flatMap((p) => p.areas)}
            markers={l.markers}
          />
        </Suspense>
      ) : (
        <Schematic
          listing={l}
          areas={areas}
          selected={selected}
          onSelect={select}
        />
      )}
    </>
  );
  const areaPanel = (
    <>
      <div className="photo-panel-heading">
        <span className="eyebrow">THE ACTUAL PHOTOS</span>
        <button
          className="icon-button close-mobile"
          onClick={() => setMobilePhotos(false)}
          aria-label="Close photo panel"
        >
          <X size={20} />
        </button>
        <div className="photo-title-row">
          <h2 aria-live="polite">{area?.label || "Select an area"}</h2>
          <span className="count-pill">
            {photos.length} {photos.length === 1 ? "photo" : "photos"}
          </span>
        </div>
        <p>
          {damage ? (
            <span className="damage-text">
              <AlertTriangle size={14} /> Seller-reported damage
            </span>
          ) : area?.group === "angle" ? (
            "See the view from this angle."
          ) : (
            "Take a closer look at this area."
          )}
        </p>
      </div>
      <div className="photo-panel-body">
        {photos.length ? (
          <>
            <div className="seller-photo-stack">
              {photos.map((p, i) => (
                <button
                  className="seller-photo"
                  key={p.id}
                  onClick={() => setLightbox(p)}
                >
                  <img
                    src={photoUrl(p.id, "display")}
                    alt={`${area?.label} — seller photo ${i + 1}`}
                    loading="lazy"
                  />
                  <span className="photo-zoom">
                    <Maximize2 size={17} />
                  </span>
                  {p.note && (
                    <span className="photo-note">Seller note: {p.note}</span>
                  )}
                </button>
              ))}
            </div>
            <p className="photo-footnote">
              Actual seller uploads · {photos.length}{" "}
              {photos.length === 1 ? "photo" : "photos"}
            </p>
          </>
        ) : (
          <div className="empty-photo">
            <div className="empty-frame">
              <span className="frame-corner tl" />
              <span className="frame-corner tr" />
              <span className="frame-corner bl" />
              <span className="frame-corner br" />
              <div className="empty-camera">
                <Camera size={33} strokeWidth={1.3} />
              </div>
              <strong>Photo not uploaded.</strong>
              <p>
                {l.unavailable.includes(selected)
                  ? "The seller marked this area as unavailable."
                  : "The seller hasn’t added a photo of this area yet."}
              </p>
            </div>
            <div className="no-inference">
              <Info size={15} />
              <span>
                A missing photo tells you nothing about the condition of this
                part.
              </span>
            </div>
          </div>
        )}
        <div className="photo-actions">
          <button
            className="button full"
            onClick={() => {
              if (photos[0]) setLightbox(photos[0]);
            }}
            disabled={!photos.length}
          >
            <Images size={16} /> View all photos for this area{" "}
            <ArrowUpRight size={15} />
          </button>
          <button
            className="text-button closeups"
            disabled={!photos.length}
            onClick={() => {
              if (photos[0]) setLightbox(photos[0]);
            }}
          >
            Close-ups <ChevronRight size={14} />
          </button>
        </div>
      </div>
      <div className="photo-panel-footer">
        <span className="shield-icon">
          <ShieldCheck size={18} />
        </span>
        <p>
          <strong>Real photos. Nothing filled in.</strong>
          <span>
            Originals are preserved. Missing views are never generated.
          </span>
        </p>
      </div>
    </>
  );
  const panel =
    view === "spin" ? (
      <>
        <div className="photo-panel-heading">
          <span className="eyebrow">THE WHOLE WALK-AROUND</span>
          <h2 className="spin-info-title">
            {l.spin.confirmed
              ? "The car. As photographed."
              : "Every angle starts with a photo."}
          </h2>
          <p>
            {l.spin.confirmed
              ? "Move through the seller’s original uploads."
              : "A photo view made from your actual car pictures."}
          </p>
        </div>
        <div className="spin-info-body">
          <div className="spin-info-count">
            <Camera size={24} />
            <strong>
              {l.spin.confirmed ? l.spin.ids.length : 0}
              <span>original photos in this view</span>
            </strong>
          </div>
          {l.spin.confirmed ? (
            <>
              <div className="spin-info-step">
                <MousePointer2 size={19} />
                <p>
                  <strong>Drag, swipe or use the slider.</strong>
                  <span>
                    Every stop shows an actual uploaded photo. Zoom to inspect a
                    detail.
                  </span>
                </p>
              </div>
              <div className="spin-info-step">
                <RotateCcw size={19} />
                <p>
                  <strong>
                    {l.spin.loop
                      ? "Seller-confirmed 360° sequence"
                      : "A partial photo sequence"}
                  </strong>
                  <span>
                    {l.spin.loop
                      ? "The seller confirmed a complete lap. The app does not independently verify angle coverage."
                      : "Navigation stops at the final uploaded view. Missing sides are not filled in."}
                  </span>
                </p>
              </div>
              <button
                className="button full"
                onClick={() => setView(l.asset ? "3d" : "map")}
              >
                <Layers size={16} /> Explore labelled parts{" "}
                <ArrowRight size={15} />
              </button>
            </>
          ) : (
            <>
              <div className="spin-info-step">
                <Camera size={19} />
                <p>
                  <strong>1. Photograph a full lap.</strong>
                  <span>
                    Take 12–24 exterior photos in one direction at a consistent
                    height.
                  </span>
                </p>
              </div>
              <div className="spin-info-step">
                <Plus size={19} />
                <p>
                  <strong>2. Upload your sequence.</strong>
                  <span>
                    Your swipeable photo view is assembled automatically, with
                    no reference asset needed.
                  </span>
                </p>
              </div>
              <div className="spin-info-step">
                <Check size={19} />
                <p>
                  <strong>3. Check, confirm and share.</strong>
                  <span>
                    Correct the order, confirm the loop, then publish your
                    listing.
                  </span>
                </p>
              </div>
              <button className="button primary full" onClick={sell}>
                Create your photo view <ArrowUpRight size={15} />
              </button>
            </>
          )}
        </div>
        <div className="photo-panel-footer">
          <span className="shield-icon">
            <ShieldCheck size={18} />
          </span>
          <p>
            <strong>Photographs, not a reconstruction.</strong>
            <span>
              No AI-generated angles. No invented missing surfaces. Coverage is
              not a condition score.
            </span>
          </p>
        </div>
      </>
    ) : (
      areaPanel
    );
  return (
    <div className="page inspection-page">
      <div className="breadcrumbs">
        <button onClick={() => navigate("/explore")}>Explore cars</button>
        <ChevronRight size={13} />
        <span>{l.vehicle.make}</span>
        <ChevronRight size={13} />
        <span>
          {l.vehicle.model} {l.year}
        </span>
      </div>
      {l.demo ? (
        <div className="demo-strip">
          <span>
            <span className="demo-dot" />
            <strong>A look inside CarView</strong>
            <span className="demo-description">
              This is an interactive demo, not a vehicle for sale. No seller
              photographs are included.
            </span>
          </span>
          <button onClick={sell}>
            Try with your car <ArrowUpRight size={14} />
          </button>
        </div>
      ) : (
        l.status === "draft" && (
          <div className="demo-strip">
            <strong>Private preview · This listing is not published.</strong>
            <button onClick={() => navigate("/garage/" + l.id)}>
              Back to editor <ArrowRight size={15} />
            </button>
          </div>
        )
      )}
      <div className="vehicle-heading">
        <div>
          <div className="heading-eyebrow">
            <span className="eyebrow green">
              {l.year} · {l.vehicle.generation.split(" · ")[0]}
            </span>
            <span className="tiny-divider" />
            <span className="subtle-text">{l.vehicle.market}</span>
          </div>
          <h1>
            {l.title} <span className="heading-year"> {l.year}</span>
          </h1>
          <div className="vehicle-specs">
            <span>
              <MapPin size={14} />
              {l.city}
            </span>
            <span>
              <Gauge size={15} />
              {money(l.mileage)} km
            </span>
            <span>
              <CarSpecIcon />
              {l.vehicle.variant}
            </span>
          </div>
        </div>
        <div className="price-heading">
          <small>{l.demo ? "ILLUSTRATIVE PRICE" : "ASKING PRICE"}</small>
          <div>
            <span>PKR</span> {money(l.price)}
          </div>
          <button
            className="text-button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  location.origin + "/listing/" + l.id,
                );
                setShared(true);
                setTimeout(() => setShared(false), 2500);
              } catch {
                window.prompt(
                  "Copy your shareable listing URL:",
                  location.origin + "/listing/" + l.id,
                );
              }
            }}
          >
            {shared ? <Check size={13} /> : <Link2 size={13} />}{" "}
            {shared ? "Link copied" : "Share listing"}
          </button>
        </div>
      </div>
      <div className="workspace-heading">
        <div>
          <span className="section-index">01</span>
          <h2>Get to know every angle.</h2>
        </div>
        <span>
          <MousePointer2 size={15} />{" "}
          {view === "spin"
            ? "Drag to explore the uploaded photos."
            : "Pick a point. See the real picture."}
        </span>
      </div>
      <div
        className={`inspection-workspace ${mobilePhotos ? "show-mobile-panel" : ""}`}
      >
        <section className="viewer-card">
          <div className="viewer-toolbar">
            <div className="viewer-tabs">
              <button
                className={view === "spin" ? "active" : ""}
                onClick={() => setView("spin")}
              >
                <Camera size={15} /> {l.spin.loop ? "360 photos" : "Photo view"}
              </button>
              <button
                className={view === "3d" ? "active" : ""}
                disabled={!l.asset}
                title={!l.asset ? "3D model not yet supported" : undefined}
                onClick={() => setView("3d")}
              >
                <Box size={15} /> 3D view{" "}
                {!l.asset && <span className="soon-dot" />}
              </button>
              <button
                className={view === "map" ? "active" : ""}
                onClick={() => setView("map")}
              >
                <Layers size={15} /> Parts map
              </button>
            </div>
            <div className="viewer-tools">
              <button
                className="icon-button"
                title="Reset view"
                aria-label="Reset view"
                onClick={() => {
                  setPreset("angle_front_right");
                  setResetKey((k) => k + 1);
                  setSelected("angle_front_right");
                }}
              >
                <RotateCcw size={16} />
              </button>
              <button
                className="icon-button"
                title="Expand viewer"
                aria-label="Expand viewer"
                onClick={() => setFull(true)}
              >
                <Maximize2 size={16} />
              </button>
            </div>
          </div>
          {viewer}
          <div className="view-presets">
            <span className="preset-label">
              {view === "spin" ? "LABELLED PARTS & VIEWS" : "QUICK VIEWS"}
            </span>
            <div>
              {shortPresets.map(([id, label]) => (
                <button
                  key={id}
                  className={view !== "spin" && selected === id ? "active" : ""}
                  onClick={() => select(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="viewer-bottom">
            <span>
              <Move size={13} />
              {view === "3d"
                ? "Drag to rotate · Scroll to zoom"
                : view === "spin"
                  ? "Drag or swipe to explore"
                  : "Select a point to explore"}
            </span>
            <span>
              {view === "spin"
                ? "Original photos · No invented views"
                : "Left / right = occupant’s perspective"}{" "}
              <Info size={12} />
            </span>
          </div>
        </section>
        <aside className="photo-panel" aria-label="Selected area photographs">
          {panel}
        </aside>
      </div>
      <section className="areas-section">
        <div className="areas-heading">
          <div>
            <span className="section-index">02</span>
            <h2>Or, go straight to a detail.</h2>
          </div>
          <div className="area-search">
            <Search size={16} />
            <input
              aria-label="Search parts and angles"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a part or angle…"
            />
          </div>
        </div>
        <div className="area-tabs" role="tablist" aria-label="Area category">
          {[
            ["angle", "Viewing angles"],
            ["exterior", "Exterior parts"],
            ["inside", "Inside & underneath"],
            ["details", "Seller details"],
          ].map(([id, label]) => (
            <button
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? "active" : ""}
              key={id}
              onClick={() => setTab(id)}
            >
              {label}
              {id === "details" && <span>{l.markers.length}</span>}
            </button>
          ))}
          <span className="areas-hint">
            <Info size={13} /> All areas are accessible without 3D
          </span>
        </div>
        <div className="area-grid">
          {allAreas
            .filter((a) =>
              query
                ? a.label.toLowerCase().includes(query.toLowerCase())
                : a.group === tab,
            )
            .map((a) => {
              const n = l.photos.filter((p) => p.areas.includes(a.id)).length;
              return (
                <button
                  key={a.id}
                  className={`area-card ${selected === a.id ? "selected" : ""}`}
                  onClick={() => select(a.id)}
                >
                  <span className="area-card-icon">
                    {a.group === "angle" ? (
                      <AngleIcon id={a.id} />
                    ) : (
                      <Camera size={20} strokeWidth={1.3} />
                    )}
                  </span>
                  <span>
                    <strong>{a.label}</strong>
                    <small>
                      {n
                        ? `${n} ${n === 1 ? "photo" : "photos"} uploaded`
                        : l.unavailable.includes(a.id)
                          ? "Marked unavailable"
                          : "Photo not uploaded"}
                    </small>
                  </span>
                  <span className={`area-status ${n ? "available" : ""}`}>
                    {n ? <span className="live-dot" /> : <Plus size={13} />}
                  </span>
                </button>
              );
            })}
          {allAreas.filter((a) =>
            query
              ? a.label.toLowerCase().includes(query.toLowerCase())
              : a.group === tab,
          ).length === 0 && (
            <p className="muted-text empty-areas">
              {tab === "details" && !query
                ? "No seller-added detail markers."
                : "No matching areas. Try another search."}
            </p>
          )}
        </div>
      </section>
      <div className="listing-bottom">
        <section className="description-card">
          <span className="eyebrow">
            {l.demo ? "ABOUT THIS DEMO" : "A NOTE FROM THE SELLER"}
          </span>
          <h2>
            {l.demo
              ? "Explore first. Upload yours next."
              : "The details, in their words."}
          </h2>
          <p>{l.description}</p>
          {l.asset && (
            <details>
              <summary>Reference model credits & limitations</summary>
              <p>
                Asset v{l.asset.version} · {l.asset.creator} · {l.asset.license}
                <br />
                {l.asset.attribution}
                <br />
                {l.asset.limitations}
              </p>
              <a href={l.asset.source_url} rel="noreferrer" target="_blank">
                Asset source
              </a>
            </details>
          )}
        </section>
        <section className="coverage-card">
          <div>
            <span className="coverage-icon">
              <Camera size={19} />
            </span>
            <span className="eyebrow">LABELLED AREA COVERAGE</span>
            <strong>
              {l.coverage}
              <span> / {l.recommended}</span>
            </strong>
          </div>
          <p>recommended areas photographed</p>
          <div className="coverage-track">
            <span style={{ width: `${(l.coverage / l.recommended) * 100}%` }} />
          </div>
          <p className="coverage-note">
            Coverage is not a condition score, authenticity check or inspection
            certification.
          </p>
        </section>
      </div>
      <div className="trust-line">
        <ShieldCheck size={17} />
        <span>
          A clearer view is a starting point. Always verify documents and
          arrange an independent inspection.
        </span>
        <span className="trust-right">EVERY DETAIL, IN VIEW.</span>
      </div>
      {lightbox && (
        <PhotoLightbox
          photos={photos}
          photo={lightbox}
          title={area?.label || "Seller photo"}
          onClose={() => setLightbox(null)}
          onChange={setLightbox}
        />
      )}
      {full && (
        <Modal
          title={
            view === "3d" ? "Reference 3D model" : "Parts map · schematic only"
          }
          wide
          onClose={() => setFull(false)}
        >
          <div className="expanded-view">{viewer}</div>
        </Modal>
      )}
    </div>
  );
}
function CarSpecIcon() {
  return <SlidersHorizontal size={14} />;
}
function AngleIcon({ id }: { id: string }) {
  let angle = 0;
  if (id.includes("rear")) angle = 180;
  if (id.includes("left")) angle -= 45;
  if (id.includes("right")) angle += 45;
  if (id === "angle_left") angle = -90;
  if (id === "angle_right") angle = 90;
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
      <rect
        x="11"
        y="8"
        width="10"
        height="17"
        rx="4"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M12 13h8m-8 7h8" stroke="currentColor" strokeWidth="1.2" />
      <g transform={`rotate(${angle} 16 16)`}>
        <path d="m13 5 3-3 3 3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M16 3v4" stroke="currentColor" />
      </g>
    </svg>
  );
}
function PhotoLightbox({
  photos,
  photo,
  title,
  onClose,
  onChange,
}: {
  photos: Photo[];
  photo: Photo;
  title: string;
  onClose: () => void;
  onChange: (p: Photo) => void;
}) {
  const [zoom, setZoom] = useState(1),
    [imageError, setImageError] = useState(false),
    [fullscreenError, setFullscreenError] = useState("");
  const imageElement = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setZoom(1);
    setImageError(false);
  }, [photo.id]);
  return (
    <Modal title={title + " · Actual seller photo"} wide onClose={onClose}>
      <div className="lightbox-tools">
        <span>
          {photos.indexOf(photo) + 1} / {photos.length}
        </span>
        <div>
          <button
            className="icon-button"
            aria-label="Zoom out"
            onClick={() => setZoom(Math.max(1, zoom - 0.5))}
          >
            <Minus size={18} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            className="icon-button"
            aria-label="Zoom in"
            onClick={() => setZoom(Math.min(4, zoom + 0.5))}
          >
            <Plus size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Full screen photo"
            disabled={!document.fullscreenEnabled}
            onClick={() =>
              imageElement.current
                ?.requestFullscreen()
                .catch(() =>
                  setFullscreenError(
                    "Full screen is unavailable. Use the expanded photo and zoom controls.",
                  ),
                )
            }
          >
            <Maximize2 size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Reset photo zoom"
            onClick={() => setZoom(1)}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>
      <ErrorBox error={fullscreenError} />
      <div className="lightbox-image" ref={imageElement}>
        {imageError ? (
          <ErrorBox error="Photo could not load. Close and reopen to retry." />
        ) : (
          <img
            src={photoUrl(photo.id, "display")}
            alt={title}
            onError={() => setImageError(true)}
            style={{ width: `${zoom * 100}%`, maxWidth: "none" }}
          />
        )}
      </div>
      {photo.note && <p className="muted-text">Seller note: {photo.note}</p>}
      <div className="lightbox-nav">
        <button
          className="button"
          disabled={photos.indexOf(photo) === 0}
          onClick={() => onChange(photos[photos.indexOf(photo) - 1])}
        >
          <ChevronLeft size={16} /> Previous
        </button>
        <span>Display copy · no retouching</span>
        <button
          className="button"
          disabled={photos.indexOf(photo) === photos.length - 1}
          onClick={() => onChange(photos[photos.indexOf(photo) + 1])}
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </Modal>
  );
}
