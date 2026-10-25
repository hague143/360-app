import { useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  GripVertical,
  ImagePlus,
  Info,
  Plus,
  RotateCw,
  Trash2,
  UploadCloud,
} from "lucide-react";
import PhotoSpin from "./PhotoSpin";
import { api, send, upload, photoUrl } from "./api";
import type { Listing } from "./types";
import { ErrorBox, Modal } from "./ui";
export default function SpinStudio({
  listing,
  onChange,
}: {
  listing: Listing;
  onChange: (l: Listing) => void;
}) {
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(""),
    [loop, setLoop] = useState(listing.spin.loop),
    [confirmed, setConfirmed] = useState(false),
    [dragged, setDragged] = useState(""),
    [chooseExisting, setChooseExisting] = useState(false),
    [picked, setPicked] = useState(listing.spin.ids);
  const file = useRef<HTMLInputElement>(null),
    l = listing,
    ids = l.spin.ids,
    frames = ids
      .map((id) => l.photos.find((p) => p.id === id))
      .filter((p) => !!p);
  async function save(newIds: string[], confirm = false, fullLoop = false) {
    const updated = await send(
      "/listings/" + l.id + "/spin",
      { ids: newIds, confirmed: confirm, loop: fullLoop },
      "PUT",
    );
    onChange(updated);
    if (!confirm) setLoop(false);
    setConfirmed(false);
  }
  async function doAction(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function uploadFrames(files: FileList | null) {
    if (!files?.length || busy) return;
    const selected = Array.from(files).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
    if (l.photos.length + selected.length > 60) {
      setError(
        "A listing can hold 60 photos. Remove unused photographs before uploading more.",
      );
      return;
    }
    await doAction(async () => {
      let current = l,
        frameIds = [...ids];
      for (let i = 0; i < selected.length; i += 6) {
        const batch = selected.slice(i, i + 6),
          form = new FormData();
        batch.forEach((f) => form.append("photos", f));
        const before = new Set(current.photos.map((p) => p.id));
        setProgress(Math.round((i / selected.length) * 100));
        current = await upload("/listings/" + l.id + "/photos", form, (n) =>
          setProgress(
            Math.round(
              ((i + (batch.length * n) / 100) / selected.length) * 100,
            ),
          ),
        );
        const newFrames = current.photos
          .filter((p) => !before.has(p.id))
          .map((p) => p.id);
        frameIds = [...frameIds, ...newFrames];
        current = await send(
          "/listings/" + l.id + "/spin",
          { ids: frameIds, confirmed: false, loop: false },
          "PUT",
        );
        onChange(current);
      }
      setLoop(false);
      setConfirmed(false);
    });
    if (file.current) file.current.value = "";
  }
  async function reorder(from: string, to: string) {
    const next = [...ids],
      a = next.indexOf(from),
      b = next.indexOf(to);
    if (a < 0 || b < 0 || a === b) return;
    next.splice(b, 0, next.splice(a, 1)[0]);
    await doAction(() => save(next));
  }
  return (
    <div className="spin-studio">
      <div className="spin-studio-main">
        <div className="spin-studio-heading">
          <div>
            <span className="eyebrow green">
              UPLOAD PHOTOS → GET A PHOTO VIEW
            </span>
            <h2>Your car, from every side.</h2>
            <p>
              Upload a walk-around sequence. Your interactive view is assembled
              automatically.
            </p>
          </div>
          {l.spin.confirmed && (
            <span className="badge">
              <CheckCircle2 size={13} />
              {l.spin.loop ? "360 LOOP READY" : "PHOTO SEQUENCE READY"}
            </span>
          )}
        </div>
        <ErrorBox error={error} />
        <div
          className="spin-upload"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            uploadFrames(e.dataTransfer.files);
          }}
        >
          <span className="upload-icon">
            <UploadCloud size={26} />
          </span>
          <div>
            <h3>
              {busy
                ? `Preparing your photo view… ${progress}%`
                : "Drop your walk-around photos here"}
            </h3>
            <p>
              12–24 exterior photos recommended · sorted by filename · originals
              preserved
            </p>
          </div>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => file.current?.click()}
          >
            <Plus size={16} /> Add photos
          </button>
          <input
            type="file"
            hidden
            ref={file}
            multiple
            accept="image/jpeg,image/png,image/webp"
            aria-label="Upload walk-around photos"
            onChange={(e) => uploadFrames(e.target.files)}
          />
          {busy && <progress value={progress} max={100} />}
        </div>
        <div className="spin-studio-preview">
          <PhotoSpin
            photos={frames}
            loop={l.spin.loop}
            confirmed={l.spin.confirmed}
            onUpload={() => file.current?.click()}
          />
        </div>
        <div className="spin-sequence-heading">
          <h3>
            Your photo sequence <span>{frames.length} frames</span>
          </h3>
          <button
            className="text-button"
            disabled={busy || !l.photos.length}
            onClick={() => {
              setPicked(ids);
              setChooseExisting(true);
            }}
          >
            <ImagePlus size={14} /> Use existing photos
          </button>
        </div>
        {frames.length > 0 && (
          <>
            <p className="spin-order-help">
              <GripVertical size={14} /> Drag frames or use arrows to correct
              the order. Frame 01 is your starting view.
            </p>
            <div className="spin-frame-grid">
              {frames.map((p, i) => (
                <div
                  className="spin-frame-card"
                  key={p.id}
                  draggable={!busy}
                  onDragStart={() => setDragged(p.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!busy) reorder(dragged, p.id);
                  }}
                >
                  <img
                    src={photoUrl(p.id)}
                    alt={`Walk-around frame ${i + 1}`}
                    loading="lazy"
                  />
                  <span className="spin-seq-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <button
                      className="icon-button"
                      aria-label={`Move frame ${i + 1} earlier`}
                      disabled={busy || i === 0}
                      onClick={() => reorder(p.id, ids[i - 1])}
                    >
                      <ArrowLeft size={14} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Move frame ${i + 1} later`}
                      disabled={busy || i === frames.length - 1}
                      onClick={() => reorder(p.id, ids[i + 1])}
                    >
                      <ArrowRight size={14} />
                    </button>
                    <button
                      className="icon-button remove-frame"
                      aria-label={`Remove frame ${i + 1} from sequence`}
                      disabled={busy}
                      title="Keeps the original photograph in your photo library"
                      onClick={() =>
                        doAction(() => save(ids.filter((id) => id !== p.id)))
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="spin-confirm">
              <div>
                <CheckCircle2 size={23} />
                <h3>
                  {l.spin.confirmed
                    ? "Your photo view is ready to publish."
                    : "One final check before sharing."}
                </h3>
              </div>
              <p>
                The app uses the order of your files; it cannot verify which
                sides they show. Confirm the sequence so buyers aren’t shown a
                misleading loop.
              </p>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={loop}
                  disabled={busy || frames.length < 12}
                  onChange={(e) => {
                    setLoop(e.target.checked);
                    setConfirmed(false);
                  }}
                />
                <span>
                  These photos cover one complete lap around the car in a
                  continuous direction. Enable the 360 loop.
                  <small>
                    {frames.length < 12
                      ? " Add at least 12 photographs to enable a full loop."
                      : " Leave off for a partial walk-around that stops at the last uploaded view."}
                  </small>
                </span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={busy || frames.length < 2}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>
                  I checked the order. These are actual photos of this car, with
                  no invented views or concealed damage.
                </span>
              </label>
              <button
                className="button primary"
                disabled={busy || !confirmed || frames.length < 2}
                onClick={() => doAction(() => save(ids, true, loop))}
              >
                <CheckCircle2 size={16} />
                {loop ? "Confirm 360 photo view" : "Confirm photo walk-around"}
              </button>
            </div>
          </>
        )}
      </div>
      <aside className="spin-capture-guide">
        <span className="eyebrow green">A GOOD SPIN STARTS HERE</span>
        <h2>
          One car.
          <br />
          One complete lap.
        </h2>
        <div className="capture-orbit">
          <RotateCw size={102} strokeWidth={0.7} />
          <Camera size={29} />
          <span>12–24 photos</span>
        </div>
        {[
          [
            "01",
            "Keep the car still",
            "Park in an open space. Keep the whole car in frame with room to walk around it.",
          ],
          [
            "02",
            "Walk in one direction",
            "Start at the front. Move clockwise, keeping roughly the same height and distance. Take a photo every 15–30°.",
          ],
          [
            "03",
            "Upload the full sequence",
            "Keep the original filenames in order. Add detail or engine close-ups separately in Photos & labels.",
          ],
        ].map(([n, title, text]) => (
          <div className="spin-tip" key={n}>
            <span>{n}</span>
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          </div>
        ))}
        <div className="info-note">
          <Info size={17} />
          <p>
            This is a photo-based view, not an AI-generated 3D scan. A few
            random photos cannot show the missing sides. Every frame is an
            actual uploaded photograph.
          </p>
        </div>
        <small>
          JPEG, PNG or WebP · 10 MB per photo · up to 60 photos per listing.
          Large selections are uploaded in safe batches.
        </small>
      </aside>
      {chooseExisting && (
        <Modal
          title="Choose walk-around frames"
          wide
          onClose={() => setChooseExisting(false)}
        >
          <p className="muted-text">
            Select exterior photos taken around the car. Keep engine, interior
            and damage close-ups in the parts gallery.
          </p>
          <div className="existing-frame-grid">
            {l.photos.map((p) => (
              <label
                key={p.id}
                className={picked.includes(p.id) ? "picked" : ""}
              >
                <img src={photoUrl(p.id)} alt="Your uploaded photograph" />
                <span>
                  <input
                    type="checkbox"
                    checked={picked.includes(p.id)}
                    onChange={(e) =>
                      setPicked(
                        e.target.checked
                          ? [...picked, p.id]
                          : picked.filter((id) => id !== p.id),
                      )
                    }
                  />{" "}
                  Include this photo
                </span>
              </label>
            ))}
          </div>
          <ErrorBox error={error} />
          <button
            className="button primary"
            disabled={busy}
            onClick={() =>
              doAction(async () => {
                await save(picked);
                setChooseExisting(false);
              })
            }
          >
            Build preview from {picked.length} photos <ArrowRight size={16} />
          </button>
        </Modal>
      )}
    </div>
  );
}
