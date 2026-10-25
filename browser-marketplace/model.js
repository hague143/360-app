const $ = (id) => document.getElementById(id);
const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  Date.now().toString(36) + Math.random().toString(36).slice(2);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const jsonSafe = (value) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
const money = (value) =>
  new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(
    Number(value) || 0,
  );
const priceWords = (value) =>
  Number(value) >= 10000000
    ? (Number(value) / 10000000)
        .toFixed(2)
        .replace(/0+$/, "")
        .replace(/\.$/, "") + " crore"
    : Number(value) >= 100000
      ? (Number(value) / 100000)
          .toFixed(2)
          .replace(/0+$/, "")
          .replace(/\.$/, "") + " lakh"
      : money(value);
const NEXT_YEAR = new Date().getFullYear() + 1;
const CITIES = [
  "Lahore",
  "Karachi",
  "Islamabad",
  "Rawalpindi",
  "Faisalabad",
  "Multan",
  "Peshawar",
  "Gujranwala",
  "Sialkot",
  "Hyderabad",
  "Quetta",
  "Bahawalpur",
  "Sargodha",
  "Sukkur",
  "Abbottabad",
  "Mardan",
  "Sahiwal",
  "Gujrat",
  "Wah Cantt",
  "Taxila",
  "Sheikhupura",
  "Jhelum",
  "Mirpur",
  "Muzaffarabad",
  "Swat",
  "Mingora",
  "Dera Ghazi Khan",
  "Dera Ismail Khan",
  "Rahim Yar Khan",
  "Okara",
  "Kasur",
  "Attock",
  "Chakwal",
  "Sadiqabad",
  "Nawabshah",
  "Larkana",
  "Khairpur",
  "Mansehra",
  "Haripur",
  "Nowshera",
  "Kohat",
  "Bannu",
  "Chiniot",
  "Jhang",
  "Vehari",
  "Mandi Bahauddin",
  "Bahawalnagar",
  "Chishtian",
  "Gilgit",
  "Skardu",
];
const CATALOG = {
  Toyota: [
    "Corolla",
    "Yaris",
    "Vitz",
    "Aqua",
    "Prius",
    "Passo",
    "Hilux",
    "Fortuner",
    "Land Cruiser",
    "Prado",
    "Camry",
    "Raize",
  ],
  Honda: [
    "Civic",
    "City",
    "BR-V",
    "HR-V",
    "Vezel",
    "Fit",
    "N-Wgn",
    "N-One",
    "Accord",
  ],
  Suzuki: [
    "Alto",
    "Cultus",
    "Wagon R",
    "Swift",
    "Mehran",
    "Bolan",
    "Ravi",
    "Every",
    "Jimny",
    "Vitara",
    "Ciaz",
    "Baleno",
  ],
  Kia: ["Sportage", "Picanto", "Stonic", "Sorento", "Carnival"],
  Hyundai: ["Tucson", "Elantra", "Sonata", "Santa Fe", "Santro", "H-100"],
  Changan: ["Alsvin", "Oshan X7", "Karvaan", "M9"],
  MG: ["HS", "ZS", "ZS EV", "4"],
  Daihatsu: ["Mira", "Move", "Cuore", "Hijet", "Rocky"],
  Nissan: ["Dayz", "Note", "Juke", "Sunny", "Roox", "Patrol"],
  Mitsubishi: ["Mirage", "Pajero", "Lancer", "eK Wagon"],
  Haval: ["H6", "Jolion"],
  Proton: ["Saga", "X70"],
  Peugeot: ["2008"],
  DFSK: ["Glory 580", "Glory 500"],
  BMW: ["3 Series", "5 Series", "7 Series", "X1", "X3", "X5"],
  Audi: ["A3", "A4", "A6", "Q3", "Q5", "Q7"],
  "Mercedes-Benz": ["C-Class", "E-Class", "S-Class", "GLA", "GLC", "GLE"],
  BYD: ["Atto 3", "Sealion 6", "Dolphin"],
  Isuzu: ["D-Max"],
  FAW: ["V2", "XPV", "Carrier"],
  BAIC: ["BJ40", "D20", "X25"],
  Prince: ["Pearl"],
  United: ["Bravo", "Alpha"],
};
const VARIANTS = {
  "Toyota|Corolla": [
    "XLi",
    "GLi",
    "Altis 1.6",
    "Altis 1.8",
    "Altis Grande 1.8",
  ],
  "Toyota|Yaris": [
    "GLi MT 1.3",
    "GLi CVT 1.3",
    "ATIV MT 1.3",
    "ATIV CVT 1.3",
    "ATIV X CVT 1.5",
  ],
  "Honda|Civic": ["Standard", "Oriel", "RS"],
  "Honda|City": ["1.2L Manual", "1.2L CVT", "1.5L CVT", "Aspire 1.5L"],
  "Suzuki|Alto": ["VX", "VXR", "VXR AGS", "VXL AGS"],
  "Suzuki|Cultus": ["VXR", "VXL", "Auto Gear Shift"],
  "Suzuki|Swift": ["GL Manual", "GL CVT", "GLX CVT"],
};
const FUELS = ["Petrol", "Diesel", "Hybrid", "Electric", "CNG", "LPG"];
const TRANSMISSIONS = ["Manual", "Automatic", "CVT"];
const COLORS = [
  "White",
  "Black",
  "Silver",
  "Grey",
  "Blue",
  "Red",
  "Green",
  "Beige",
  "Gold",
  "Brown",
  "Maroon",
];
const BODY_TYPES = [
  "Sedan",
  "Hatchback",
  "SUV",
  "Crossover",
  "MPV",
  "Van",
  "Pickup",
  "Coupe",
  "Convertible",
  "Wagon",
  "Other",
];
const FEATURES = [
  "Air conditioning",
  "ABS",
  "Airbags",
  "Power steering",
  "Power windows",
  "Power mirrors",
  "Alloy wheels",
  "Central locking",
  "Keyless entry",
  "Push start",
  "Cruise control",
  "Sunroof",
  "Rear camera",
  "Parking sensors",
  "Navigation",
  "Bluetooth",
  "USB / AUX",
  "Fog lights",
  "Traction control",
  "Stability control",
  "ISOFIX",
  "Leather seats",
  "Heated seats",
  "Immobilizer",
];
const STEPS = [
  "Car details",
  "Specifications",
  "Photos & 360",
  "Contact",
  "Preview",
];
const IMAGE_DATA = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
let appState = { version: 1, ads: [] },
  view = { kind: "browse" },
  database = null,
  marketStorageKey = "workspace";
let formErrors = {},
  mediaBusy = false,
  saveTimer = null,
  saveQueue = Promise.resolve(),
  revision = 0;
let activeStudio = null,
  toastTimer = null;
const filters = {
  query: "",
  city: "",
  make: "",
  minPrice: "",
  maxPrice: "",
  minYear: "",
  maxYear: "",
  fuel: "",
  transmission: "",
  maxMileage: "",
  sort: "newest",
  more: false,
};
const blankDetails = () => ({
  city: "",
  area: "",
  make: "",
  customMake: "",
  model: "",
  customModel: "",
  year: "",
  variant: "",
  registration: "",
  color: "",
  fuel: "",
  transmission: "",
  assembly: "",
  bodyType: "",
  engineCC: "",
  mileage: "",
  price: "",
  negotiable: false,
  description: "",
  features: [],
});
const blankStudio = () => ({
  version: 1,
  id: uid(),
  title: "",
  year: "",
  city: "",
  notes: "",
  loop: false,
  photos: [],
});
function newAd() {
  return {
    id: uid(),
    status: "draft",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    step: 1,
    details: blankDetails(),
    contact: {
      name: "",
      phone: "",
      whatsapp: false,
      sellerType: "Private seller",
    },
    gallery: [],
    studio: blankStudio(),
  };
}
function currentAd() {
  return appState.ads.find((ad) => ad.id === view.id);
}
function makeOf(ad) {
  return ad.details.make === "Other"
    ? ad.details.customMake.trim()
    : ad.details.make;
}
function modelOf(ad) {
  return ad.details.model === "Other"
    ? ad.details.customModel.trim()
    : ad.details.model;
}
function titleOf(ad) {
  return (
    [makeOf(ad), modelOf(ad), ad.details.variant, ad.details.year]
      .filter(Boolean)
      .join(" ") || "Your car · unfinished draft"
  );
}
function coverOf(ad) {
  return ad.gallery[0]?.src || ad.studio.photos[0]?.src || "";
}
function phoneNumber(value) {
  const input = String(value || "").trim();
  if (!/^[+\d\s()-]+$/.test(input)) return "";
  let number = input.replace(/\D/g, "");
  if (number.startsWith("0092")) number = number.slice(2);
  if (/^03\d{9}$/.test(number)) number = "92" + number.slice(1);
  return /^923\d{9}$/.test(number) ? number : "";
}
function cleanPhoto(photo) {
  if (
    !photo ||
    typeof photo.src !== "string" ||
    photo.src.length > 16000000 ||
    !IMAGE_DATA.test(photo.src) ||
    typeof photo.thumb !== "string" ||
    photo.thumb.length > 500000 ||
    !IMAGE_DATA.test(photo.thumb)
  )
    throw new Error("A saved photo is invalid.");
  return {
    id: typeof photo.id === "string" ? photo.id.slice(0, 100) : uid(),
    name: String(photo.name || "Car photo").slice(0, 180),
    src: photo.src,
    thumb: photo.thumb,
  };
}
function cleanStudio(value) {
  if (
    !value ||
    value.version !== 1 ||
    !Array.isArray(value.photos) ||
    value.photos.length > 120
  )
    throw new Error("Unsupported saved 360 photo data.");
  const result = blankStudio();
  result.id = typeof value.id === "string" ? value.id.slice(0, 100) : uid();
  for (const key of ["title", "year", "city", "notes"])
    result[key] = String(value[key] || "").slice(
      0,
      key === "notes" ? 1500 : 90,
    );
  result.photos = value.photos.map(cleanPhoto);
  result.loop = value.loop === true && result.photos.length >= 12;
  return result;
}
function cleanAd(value) {
  if (
    !value ||
    typeof value.id !== "string" ||
    !value.details ||
    !Array.isArray(value.gallery) ||
    value.gallery.length > 20
  )
    throw new Error("Invalid car ad.");
  const ad = newAd();
  ad.id = value.id.slice(0, 100);
  ad.status = ["draft", "listed", "sold"].includes(value.status)
    ? value.status
    : "draft";
  ad.createdAt = Number.isFinite(value.createdAt)
    ? value.createdAt
    : Date.now();
  ad.updatedAt = Number.isFinite(value.updatedAt)
    ? value.updatedAt
    : ad.createdAt;
  ad.step =
    Number.isInteger(value.step) && value.step >= 1 && value.step <= 5
      ? value.step
      : 1;
  for (const key of Object.keys(ad.details)) {
    if (key === "features")
      ad.details.features = Array.isArray(value.details.features)
        ? value.details.features.filter((feature) => FEATURES.includes(feature))
        : [];
    else if (key === "negotiable")
      ad.details.negotiable = value.details.negotiable === true;
    else
      ad.details[key] = String(value.details[key] ?? "").slice(
        0,
        key === "description" ? 4000 : 120,
      );
  }
  for (const key of ["name", "phone", "sellerType"])
    ad.contact[key] = String(value.contact?.[key] || "").slice(0, 80);
  ad.contact.whatsapp = value.contact?.whatsapp === true;
  ad.gallery = value.gallery.map(cleanPhoto);
  ad.studio = cleanStudio(value.studio || blankStudio());
  return ad;
}
function cleanState(value) {
  if (
    !value ||
    value.version !== 1 ||
    !Array.isArray(value.ads) ||
    value.ads.length > 25
  )
    throw new Error("Unsupported saved app data.");
  const ads = value.ads.map(cleanAd);
  if (new Set(ads.map((ad) => ad.id)).size !== ads.length)
    throw new Error("Duplicate ad IDs in saved data.");
  return {
    version: 1,
    ads,
    startId: typeof value.startId === "string" ? value.startId : null,
    copyId:
      typeof value.copyId === "string" ? value.copyId.slice(0, 100) : null,
    startView: value.startView === "garage" ? "garage" : null,
  };
}
function validateStep(ad, step) {
  const d = ad.details,
    errors = {};
  const required = (key, label) => {
    if (!String(d[key] || "").trim()) errors[key] = label + " is required.";
  };
  if (step === 1) {
    required("city", "City");
    required("make", "Make");
    required("model", "Model");
    if (d.make === "Other" && !d.customMake.trim())
      errors.customMake = "Enter the car make.";
    if (d.model === "Other" && !d.customModel.trim())
      errors.customModel = "Enter the model.";
    if (
      !/^\d{4}$/.test(d.year) ||
      Number(d.year) < 1940 ||
      Number(d.year) > NEXT_YEAR
    )
      errors.year = "Choose a model year from 1940 to " + NEXT_YEAR + ".";
  }
  if (step === 2) {
    for (const [key, label] of [
      ["registration", "Registration city/status"],
      ["color", "Exterior colour"],
      ["fuel", "Fuel type"],
      ["transmission", "Transmission"],
      ["assembly", "Assembly"],
    ])
      required(key, label);
    if (!/^\d+$/.test(d.mileage) || Number(d.mileage) > 2000000)
      errors.mileage = "Enter mileage from 0 to 2,000,000 km.";
    if (
      !/^\d+$/.test(d.price) ||
      Number(d.price) < 1 ||
      Number(d.price) > 2000000000
    )
      errors.price = "Enter an asking price in PKR, up to 2,000,000,000.";
    if (d.engineCC && (!/^\d+$/.test(d.engineCC) || Number(d.engineCC) > 10000))
      errors.engineCC = "Enter engine capacity from 0 to 10,000 cc.";
    if (d.description.trim().length < 20)
      errors.description = "Describe your car in at least 20 characters.";
  }
  if (step === 3 && !ad.gallery.length && !ad.studio.photos.length)
    errors.media = "Add at least one car photo or a photo/video walk-around.";
  if (step === 4) {
    if (ad.contact.name.trim().length < 2)
      errors.name = "Enter your name (at least 2 characters).";
    if (!phoneNumber(ad.contact.phone))
      errors.phone =
        "Enter a Pakistani mobile number, e.g. 03001234567 or +923001234567.";
  }
  return errors;
}
function allErrors(ad) {
  for (let step = 1; step <= 4; step++) {
    const errors = validateStep(ad, step);
    if (Object.keys(errors).length) return { step, errors };
  }
  return null;
}
function openDatabase() {
  return new Promise((resolve, reject) => {
    let request;
    try {
      request = indexedDB.open("carview-marketplace-v1", 1);
    } catch (error) {
      reject(error);
      return;
    }
    let expired = false;
    const timeout = setTimeout(() => {
      expired = true;
      reject(new Error("Browser storage did not open."));
    }, 3000);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("state"))
        request.result.createObjectStore("state");
    };
    request.onerror = () => {
      clearTimeout(timeout);
      reject(request.error);
    };
    request.onblocked = () => {
      clearTimeout(timeout);
      expired = true;
      reject(new Error("Browser storage is busy."));
    };
    request.onsuccess = () => {
      clearTimeout(timeout);
      if (expired) {
        request.result.close();
        return;
      }
      const connection = request.result;
      connection.onversionchange = () => {
        connection.close();
        database = null;
        storageLabel("Session only · download a backup");
      };
      resolve(connection);
    };
  });
}
function storedState() {
  return new Promise((resolve, reject) => {
    const request = database
      .transaction("state", "readonly")
      .objectStore("state")
      .get(marketStorageKey);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function storageLabel(message) {
  $("storage-status").textContent = message;
}
function persist(ad = null) {
  if (ad) ad.updatedAt = Date.now();
  revision++;
  clearTimeout(saveTimer);
  if (!database) {
    storageLabel("Session only · download your ad/backup before closing");
    return;
  }
  storageLabel("Saving on this device…");
  saveTimer = setTimeout(saveNow, 400);
}
function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!database) return Promise.resolve();
  const snapshot = structuredClone(appState),
    version = revision;
  saveQueue = saveQueue
    .catch(() => {})
    .then(
      () =>
        new Promise((resolve, reject) => {
          if (!database) {
            resolve();
            return;
          }
          const transaction = database.transaction("state", "readwrite");
          transaction.objectStore("state").put(snapshot, marketStorageKey);
          transaction.oncomplete = () => {
            if (version === revision) storageLabel("Saved on this device");
            resolve();
          };
          transaction.onerror = transaction.onabort = () =>
            reject(transaction.error || new Error("Storage full"));
        }),
    )
    .catch(() => {
      storageLabel("Not saved · download a backup");
      toast(
        "Browser storage is full or blocked. Download your ad or a backup before closing.",
      );
    });
  return saveQueue;
}
function toast(message) {
  clearTimeout(toastTimer);
  $("toast").textContent = message;
  $("toast").hidden = false;
  toastTimer = setTimeout(() => ($("toast").hidden = true), 6500);
}
