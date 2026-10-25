import {
  Camera,
  Info,
  RotateCcw,
  MousePointer2,
  MoveUpRight,
} from "lucide-react";
import type { Listing, Area } from "./types";
const points: [string, number, number, string][] = [
  ["angle_front", 320, 81, "Front"],
  ["bonnet", 320, 193, "Bonnet"],
  ["mirror_left", 222, 279, "Left mirror"],
  ["mirror_right", 418, 279, "Right mirror"],
  ["door_front_left", 235, 351, "Left front door"],
  ["door_front_right", 405, 351, "Right front door"],
  ["boot_lid", 320, 527, "Boot lid"],
  ["angle_rear_right", 451, 571, "Rear-right"],
  ["engine_bay", 320, 242, "Engine bay"],
];
export default function Schematic({
  listing,
  selected,
  onSelect,
  areas,
}: {
  listing: Listing;
  selected: string;
  onSelect: (id: string) => void;
  areas: Area[];
}) {
  return (
    <div className="schematic">
      <div className="map-grid" />
      <div className="schematic-top">
        <span className="eyebrow">
          <span className="live-dot" /> INTERACTIVE PARTS MAP
        </span>
        <span className="subtle-pill">Schematic only</span>
      </div>
      <div className="compass">
        <span>N</span>
        <MoveUpRight size={18} />
        <small>FRONT</small>
      </div>
      <svg
        className="car-map"
        viewBox="0 0 640 650"
        role="img"
        aria-label="Generic top-down parts diagram. This is not a 3D model or representation of this vehicle."
      >
        <defs>
          <linearGradient id="body" x1="0" x2="1" y1="0" y2="1">
            <stop stopColor="#fafdfc" />
            <stop offset=".5" stopColor="#e1ece8" />
            <stop offset="1" stopColor="#cbded6" />
          </linearGradient>
          <linearGradient id="glass" x1="0" x2="1" y1="0" y2="1">
            <stop stopColor="#73928e" />
            <stop offset="1" stopColor="#a9c2ba" />
          </linearGradient>
          <filter id="shadow">
            <feDropShadow
              dx="10"
              dy="16"
              stdDeviation="12"
              floodColor="#183f35"
              floodOpacity=".15"
            />
          </filter>
        </defs>
        <ellipse
          cx="320"
          cy="337"
          rx="237"
          ry="268"
          fill="none"
          stroke="#bfd1c9"
          strokeDasharray="3 9"
        />
        <path d="M320 46v32m0 508v32M72 337h30m436 0h30" stroke="#bccfc5" />
        <g filter="url(#shadow)">
          <rect x="216" y="192" width="23" height="79" rx="9" fill="#49605d" />
          <rect x="401" y="192" width="23" height="79" rx="9" fill="#49605d" />
          <rect x="216" y="456" width="23" height="79" rx="9" fill="#49605d" />
          <rect x="401" y="456" width="23" height="79" rx="9" fill="#49605d" />
          <path
            d="M251 110Q320 84 389 110Q406 119 408 171L414 486Q414 545 394 567Q320 589 246 567Q226 545 226 486L232 171Q234 119 251 110Z"
            fill="url(#body)"
            stroke="#839f94"
            strokeWidth="2"
          />
          <path
            d="M250 134Q320 112 390 134M241 162Q320 145 399 162L388 234Q320 218 252 234Z"
            fill="#e7f0eb"
            stroke="#a1b8ad"
          />
          <path
            d="M252 249Q320 224 388 249L379 303Q320 292 261 303Z"
            fill="url(#glass)"
            stroke="#7a998c"
            strokeWidth="2"
          />
          <path
            d="M261 321Q320 310 379 321L381 430Q320 445 259 430Z"
            fill="#d8e7de"
            stroke="#92ab9d"
          />
          <path
            d="M260 449Q320 464 380 449L388 493Q320 518 252 493Z"
            fill="url(#glass)"
            stroke="#7a998c"
            strokeWidth="2"
          />
          <path
            d="M247 513Q320 537 393 513L394 548Q320 565 246 548Z"
            fill="#e5eee8"
            stroke="#a1b8ad"
          />
          <path
            d="M244 272L253 311L251 421L239 460ZM396 272L387 311L389 421L401 460Z"
            fill="#7c9b91"
            stroke="#6e8e81"
          />
          <path
            d="M233 368h20m134 0h20M236 482h15m138 0h15"
            stroke="#8ba79a"
            strokeWidth="2"
          />
          <path
            d="M232 273L212 280Q207 290 215 294L234 289M408 273L428 280Q433 290 425 294L406 289"
            fill="#cfdfd6"
            stroke="#839f94"
            strokeWidth="2"
          />
          <path
            d="M245 122l31-8-8 16-24 6Zm150 0-31-8 8 16 24 6Z"
            fill="#fff"
            stroke="#96afa1"
          />
          <path
            d="M240 550l32 8v11l-29-9Zm160 0-32 8v11l29-9Z"
            fill="#bf9990"
          />
          <path d="M283 105h74m-82 475h90" stroke="#839f94" strokeWidth="3" />
        </g>
      </svg>
      <div className="map-hotspots">
        {points.map(([id, x, y, label]) => (
          <button
            key={id}
            aria-label={label}
            title={label}
            className={`map-point ${selected === id ? "selected" : ""} ${listing.photos.some((p) => p.areas.includes(id)) ? "has-photo" : ""}`}
            style={{ left: `${(x / 640) * 100}%`, top: `${(y / 650) * 100}%` }}
            onClick={() => onSelect(id)}
          >
            <span />
            {selected === id && (
              <b>{areas.find((a) => a.id === id)?.label || label}</b>
            )}
          </button>
        ))}
      </div>
      <div className="map-legend">
        <span>
          <i className="legend-dot filled" /> Photos uploaded
        </span>
        <span>
          <i className="legend-dot" /> Photo not uploaded
        </span>
      </div>
      <div className="unsupported-note">
        <Info size={15} />
        <span>
          <strong>3D model not yet supported.</strong> Use this schematic or the
          area list to explore actual photos.
        </span>
      </div>
    </div>
  );
}
