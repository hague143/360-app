import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Expand,
  Hand,
  Info,
  Minus,
  Plus,
  RotateCcw,
  UploadCloud,
} from "lucide-react";
import { photoUrl } from "./api";
import type { Photo } from "./types";
export default function PhotoSpin({
  photos,
  loop = false,
  confirmed = false,
  onUpload,
  resetKey = 0,
}: {
  photos: Photo[];
  loop?: boolean;
  confirmed?: boolean;
  onUpload?: () => void;
  resetKey?: number;
}) {
  const [frame, setFrame] = useState(0),
    [zoom, setZoom] = useState(1),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(false),
    [fullscreenError, setFullscreenError] = useState("");
  const host = useRef<HTMLDivElement>(null),
    drag = useRef<{ x: number; start: number } | null>(null);
  const count = photos.length,
    photo = photos[Math.min(frame, Math.max(0, count - 1))];
  function choose(n: number) {
    if (count)
      setFrame(
        loop
          ? ((n % count) + count) % count
          : Math.max(0, Math.min(count - 1, n)),
      );
  }
  useEffect(() => {
    setFrame(0);
    setZoom(1);
  }, [resetKey, photos.map((p) => p.id).join(",")]);
  useEffect(() => {
    const image = host.current?.querySelector(
      ".spin-stage img",
    ) as HTMLImageElement | null;
    setLoaded(!!image?.complete && !!image.naturalWidth);
    setError(false);
  }, [photo?.id]);
  // Warm only the immediate neighboring display copies; a full 60-image preload
  // is needlessly expensive on phones. These images are never composited.
  useEffect(() => {
    const nearby = [frame - 1, frame + 1];
    const pending: HTMLImageElement[] = [];
    for (const n of nearby) {
      const i = loop ? (n + count) % count : n;
      if (i >= 0 && i < count) {
        const image = new Image();
        image.src = photoUrl(photos[i].id, "display");
        pending.push(image);
      }
    }
    return () => {
      pending.forEach((i) => {
        i.src = "";
      });
    };
  }, [frame, count, loop]);
  return (
    <div className="photo-spin" ref={host}>
      <div className="spin-topline">
        <span className="eyebrow">
          <Camera size={13} />
          {loop ? "360 PHOTO VIEW" : "PHOTO WALK-AROUND"}
        </span>
        <span className="spin-source">
          {!count
            ? "No photos uploaded"
            : confirmed
              ? "Seller-confirmed sequence"
              : "Preview · check the order"}
        </span>
      </div>
      {!count ? (
        <div className="spin-empty">
          <div className="spin-orbit">
            <Camera size={43} strokeWidth={1.2} />
            <span>360°</span>
          </div>
          <span className="eyebrow green">YOUR PHOTOS. EVERY ANGLE.</span>
          <h2>
            A walk around your car.
            <br />
            Without leaving the screen.
          </h2>
          <p>
            Upload 12–24 photos taken around your car.
            <br />
            We’ll turn them into a swipeable photo view.
          </p>
          {onUpload && (
            <button className="button primary" onClick={onUpload}>
              <UploadCloud size={17} /> Upload your car photos{" "}
              <ArrowRight size={15} />
            </button>
          )}
          <small>No generated angles. Only the photos you upload.</small>
        </div>
      ) : (
        <>
          <div
            className="spin-stage"
            tabIndex={0}
            role="group"
            aria-label="Interactive photo walk-around. Drag horizontally or use left and right arrow keys."
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                e.preventDefault();
                choose(frame + 1);
              }
              if (e.key === "ArrowLeft") {
                e.preventDefault();
                choose(frame - 1);
              }
              if (e.key === "Home") {
                e.preventDefault();
                choose(0);
              }
              if (e.key === "End") {
                e.preventDefault();
                choose(count - 1);
              }
            }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              drag.current = { x: e.clientX, start: frame };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (drag.current) {
                const step = Math.max(
                  10,
                  e.currentTarget.clientWidth / Math.max(count, 12),
                );
                choose(
                  drag.current.start +
                    Math.round((drag.current.x - e.clientX) / step),
                );
              }
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          >
            <img
              key={photo.id}
              src={photoUrl(photo.id, "display")}
              alt={`Actual seller photograph ${frame + 1} of ${count}`}
              style={{ transform: `scale(${zoom})` }}
              draggable={false}
              onLoad={() => {
                setLoaded(true);
                setError(false);
              }}
              onError={() => {
                setError(true);
                setLoaded(false);
              }}
            />
            {!loaded && !error && (
              <span className="spin-image-status" role="status">
                Loading original-photo display copy…
              </span>
            )}
            {error && (
              <div className="spin-image-status error" role="alert">
                Photo could not load.{" "}
                <button
                  className="text-button"
                  onClick={() => {
                    setError(false);
                    const image = host.current?.querySelector(
                      ".spin-stage img",
                    ) as HTMLImageElement;
                    image.src =
                      photoUrl(photo.id, "display") + "?retry=" + Date.now();
                  }}
                >
                  Retry this photo
                </button>
              </div>
            )}
            <span className="spin-frame-number" aria-live="polite">
              {String(frame + 1).padStart(2, "0")}{" "}
              <span>/ {String(count).padStart(2, "0")} photos</span>
            </span>
          </div>
          <div className="spin-controls">
            <button
              className="icon-button"
              aria-label="Previous photo angle"
              disabled={!loop && frame === 0}
              onClick={() => choose(frame - 1)}
            >
              <ArrowLeft size={19} />
            </button>
            <input
              type="range"
              aria-label="Photo viewing angle"
              min={0}
              max={Math.max(0, count - 1)}
              value={frame}
              onChange={(e) => choose(Number(e.target.value))}
            />
            <button
              className="icon-button"
              aria-label="Next photo angle"
              disabled={!loop && frame === count - 1}
              onClick={() => choose(frame + 1)}
            >
              <ArrowRight size={19} />
            </button>
            <span className="spin-control-divider" />
            <button
              className="icon-button"
              aria-label="Zoom photo out"
              disabled={zoom <= 1}
              onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
            >
              <Minus size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Zoom photo in"
              disabled={zoom >= 2}
              onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
            >
              <Plus size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Reset photo sequence"
              onClick={() => {
                choose(0);
                setZoom(1);
              }}
            >
              <RotateCcw size={16} />
            </button>
            <button
              className="icon-button"
              aria-label="Full screen walk-around"
              disabled={!document.fullscreenEnabled}
              onClick={() =>
                host.current
                  ?.requestFullscreen()
                  .catch(() =>
                    setFullscreenError(
                      "Full screen unavailable; drag or use the slider to explore.",
                    ),
                  )
              }
            >
              <Expand size={17} />
            </button>
          </div>
          <div className="spin-instructions">
            <span>
              <Hand size={14} /> Drag or swipe to change the view
            </span>
            <span>
              {loop
                ? "360° loop · seller-confirmed"
                : "Partial sequence · stops at the last uploaded view"}
            </span>
          </div>
        </>
      )}
      <div className="spin-integrity">
        <Info size={14} />
        <span>
          {fullscreenError ||
            "Actual uploaded photos, displayed in sequence. No 3D reconstruction or invented views."}
        </span>
      </div>
    </div>
  );
}
