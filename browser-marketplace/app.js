const CAR_ART =
  '<svg viewBox="0 0 160 90" aria-hidden="true"><path d="m17 53 11-5 16-22q3-4 9-4h43q6 0 11 5l18 21 17 4q6 2 6 8v9h-12m-19 0H51m-20 0H15V57q0-3 2-4ZM46 30 34 48h78L97 30ZM67 30v18m20-18 7 18M20 57h11m99 0h12M68 55h10"/><circle cx="41" cy="67" r="11"/><circle cx="127" cy="67" r="11"/><circle cx="41" cy="67" r="4"/><circle cx="127" cy="67" r="4"/><path d="M13 83h139" stroke-dasharray="3 5"/></svg>';
const prettyDate = (time) =>
  new Intl.DateTimeFormat("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Karachi",
  }).format(new Date(time));
function options(values, selected, prompt = "Select an option") {
  return (
    '<option value="">' +
    esc(prompt) +
    "</option>" +
    values
      .map(
        (value) =>
          '<option value="' +
          esc(value) +
          '"' +
          (String(selected) === String(value) ? " selected" : "") +
          ">" +
          esc(value) +
          "</option>",
      )
      .join("")
  );
}
function field(key, label, config = {}) {
  const ad = currentAd(),
    scope = config.scope || "details",
    value = ad[scope][key] ?? "",
    error = formErrors[key];
  const attrs =
    ' id="field-' +
    key +
    '" data-field="' +
    key +
    '" data-scope="' +
    scope +
    '"' +
    (error ? ' aria-invalid="true" aria-describedby="error-' + key + '"' : "") +
    (config.required ? ' aria-required="true"' : "");
  let control;
  if (config.options)
    control =
      "<select" +
      attrs +
      ">" +
      options(config.options, value, config.prompt) +
      "</select>";
  else if (config.textarea)
    control =
      "<textarea" +
      attrs +
      ' maxlength="4000" placeholder="' +
      esc(config.placeholder || "") +
      '">' +
      esc(value) +
      "</textarea>";
  else
    control =
      "<input" +
      attrs +
      ' type="' +
      (config.type || "text") +
      '" value="' +
      esc(value) +
      '" maxlength="' +
      (config.max || 120) +
      '"' +
      (config.numeric ? ' inputmode="numeric"' : "") +
      (config.list ? ' list="' + config.list + '"' : "") +
      ' placeholder="' +
      esc(config.placeholder || "") +
      '"' +
      (config.autocomplete
        ? ' autocomplete="' + config.autocomplete + '"'
        : "") +
      ">";
  return (
    '<div class="field' +
    (error ? " error" : "") +
    (config.full ? " span-2" : "") +
    '"' +
    (config.wrap ? ' id="' + config.wrap + '"' : "") +
    (config.hidden ? " hidden" : "") +
    '><label for="field-' +
    key +
    '">' +
    esc(label) +
    (config.required ? ' <span class="required">*</span>' : "") +
    "</label>" +
    control +
    (config.help ? "<small>" + esc(config.help) + "</small>" : "") +
    (error
      ? '<small class="error-text" id="error-' +
        key +
        '">' +
        esc(error) +
        "</small>"
      : "") +
    "</div>"
  );
}
function validationBox() {
  return Object.keys(formErrors).length
    ? '<div class="notice error validation-summary" id="form-errors" role="alert" tabindex="-1"><b>Please check these details.</b><ul>' +
        Object.values(formErrors)
          .map((error) => "<li>" + esc(error) + "</li>")
          .join("") +
        "</ul></div>"
    : "";
}
function sectionTitle(number, title, description) {
  return (
    '<div class="section-title"><span class="section-number">' +
    number +
    "</span><div><h2>" +
    esc(title) +
    "</h2><p>" +
    esc(description) +
    "</p></div></div>"
  );
}
function carStep(ad) {
  const d = ad.details;
  return (
    '<section class="form-card">' +
    sectionTitle(
      "01",
      "Tell us about your car",
      "Start with its location and exact model. Fields marked * are required.",
    ) +
    '<div class="form-grid">' +
    field("city", "City", {
      required: true,
      list: "cities",
      placeholder: "e.g. Lahore",
    }) +
    field("area", "Area / neighbourhood", {
      placeholder: "e.g. DHA Phase 6",
      help: "Optional. A neighbourhood is enough; no home address needed.",
    }) +
    field("make", "Make", {
      required: true,
      options: [...Object.keys(CATALOG).sort(), "Other"],
      prompt: "Select make",
    }) +
    field("model", "Model", {
      required: true,
      options: [...(CATALOG[d.make] || []), "Other"],
      prompt: "Select model",
    }) +
    field("customMake", "Other make", {
      wrap: "custom-make-wrap",
      hidden: d.make !== "Other",
      placeholder: "Enter make",
    }) +
    field("customModel", "Other model", {
      wrap: "custom-model-wrap",
      hidden: d.model !== "Other",
      placeholder: "Enter model",
    }) +
    field("year", "Model year", {
      required: true,
      options: Array.from({ length: NEXT_YEAR - 1939 }, (_, i) =>
        String(NEXT_YEAR - i),
      ),
      prompt: "Select year",
    }) +
    field("variant", "Variant / version", {
      list: "variants",
      placeholder: "e.g. GLi 1.3, Oriel, VXL AGS",
      help: "Optional. Choose or type the exact variant shown on your documents.",
    }) +
    '</div><datalist id="cities">' +
    CITIES.map((city) => '<option value="' + esc(city) + '">').join("") +
    '</datalist><datalist id="variants">' +
    (VARIANTS[d.make + "|" + d.model] || [])
      .map((value) => '<option value="' + esc(value) + '">')
      .join("") +
    '</datalist><div class="info-box">Choose the model and year carefully. The starter model list includes common Pakistan-market cars; use Other for a car that is not listed.</div></section>'
  );
}
function specsStep(ad) {
  const d = ad.details;
  return (
    '<section class="form-card">' +
    sectionTitle(
      "02",
      "The details buyers look for",
      "Specifications, asking price and the story behind your car.",
    ) +
    '<div class="form-grid">' +
    field("registration", "Registered in", {
      required: true,
      list: "registrations",
      placeholder: "e.g. Lahore / Unregistered",
    }) +
    field("mileage", "Mileage (km)", {
      required: true,
      numeric: true,
      max: 7,
      placeholder: "e.g. 65000",
    }) +
    field("color", "Exterior colour", {
      required: true,
      list: "colours",
      placeholder: "e.g. White",
    }) +
    field("assembly", "Assembly", {
      required: true,
      options: ["Local", "Imported"],
    }) +
    field("fuel", "Fuel type", { required: true, options: FUELS }) +
    field("transmission", "Transmission", {
      required: true,
      options: TRANSMISSIONS,
    }) +
    field("engineCC", "Engine capacity (cc)", {
      numeric: true,
      max: 5,
      placeholder: "e.g. 1300",
      help: "For an electric car, leave blank or enter 0.",
    }) +
    field("bodyType", "Body type", {
      options: BODY_TYPES,
      prompt: "Optional",
    }) +
    field("price", "Asking price (PKR)", {
      required: true,
      numeric: true,
      max: 10,
      placeholder: "e.g. 3850000",
      help: "Enter the full amount in rupees.",
    }) +
    '<div class="field"><span>Price guide</span><strong id="price-words" style="font-size:22px;letter-spacing:-.5px">' +
    (d.price ? "PKR " + esc(priceWords(d.price)) : "Your asking price") +
    '</strong><label class="check-line" style="font-weight:400"><input type="checkbox" data-field="negotiable" data-scope="details"' +
    (d.negotiable ? " checked" : "") +
    "> Price is negotiable</label></div>" +
    field("description", "Description", {
      required: true,
      textarea: true,
      full: true,
      placeholder:
        "Tell buyers about ownership, maintenance, body condition, any repairs and why you are selling. Please describe known faults honestly.",
      help: "20–4,000 characters. Avoid adding phone numbers here; use the contact step.",
    }) +
    '</div><datalist id="registrations"><option value="Unregistered">' +
    CITIES.map((city) => '<option value="' + esc(city) + '">').join("") +
    '</datalist><datalist id="colours">' +
    COLORS.map((colour) => '<option value="' + esc(colour) + '">').join("") +
    '</datalist></section><section class="form-card"><div class="section-title"><div><h2>Features & equipment</h2><p>Tick only the features fitted to this car.</p></div></div><div class="feature-grid">' +
    FEATURES.map(
      (feature) =>
        '<label><input type="checkbox" data-feature="' +
        esc(feature) +
        '"' +
        (d.features.includes(feature) ? " checked" : "") +
        ">" +
        esc(feature) +
        "</label>",
    ).join("") +
    "</div></section>"
  );
}
function galleryItems(ad) {
  return ad.gallery
    .map(
      (photo, index) =>
        '<div class="gallery-item"><img src="' +
        esc(photo.thumb) +
        '" alt="Car photo ' +
        (index + 1) +
        '" draggable="false"><div class="photo-tools">' +
        (index === 0
          ? '<span class="cover-tag">COVER</span>'
          : '<button data-action="cover" data-index="' +
            index +
            '" aria-label="Use photo ' +
            (index + 1) +
            ' as cover">Set cover</button>') +
        '<button data-action="remove-photo" data-index="' +
        index +
        '" aria-label="Remove photo ' +
        (index + 1) +
        '">Remove</button></div></div>',
    )
    .join("");
}
function mediaStep(ad) {
  return (
    '<section class="form-card">' +
    sectionTitle(
      "03",
      "Show the complete picture",
      "Add ordinary ad photos, an interactive walk-around, or both.",
    ) +
    '<div class="gallery-drop"><h3>Photos that help buyers decide.</h3><p>Exterior, interior, engine and any areas you want to explain.<br>JPG, PNG, WebP · 10 MB each · up to 20 ad photos</p><button class="btn primary" data-action="choose-gallery">＋ Add car photos</button><p class="photo-busy" id="photo-busy" hidden></p></div><div class="gallery-grid" id="gallery-grid">' +
    galleryItems(ad) +
    '</div><div class="ad-video-section"><div class="studio-heading"><div><h3>Car video</h3><p>The original clip plays in your preview and published ad. MP4/H.264 recommended · up to 50 MB.</p></div><button class="btn small" data-action="choose-video">＋ Add video</button></div><div id="ad-video-editor">' +
    videoEditor(ad) +
    '</div></div><div class="studio-section"><div class="studio-heading"><div><h3>Interactive 360° photo view</h3><p>Use your photo sequence or a full walk-around video. Choose Create photo view after selecting a clip to build its interactive angles.</p></div><button class="btn small" data-action="import-studio">Use saved 360 HTML</button></div><p class="studio-caption" id="studio-caption"></p><div class="studio-host" id="studio-host"></div><div class="info-box">Your ad includes all gallery photos, every walk-around frame and the saved original video. In the 360 studio, use an ordered exterior lap; keep close-ups and interior shots in the gallery. Videos over 50 MB can still produce frames in the studio, but the original clip must be shortened to save in the ad.</div></div></section>'
  );
}
function contactStep(ad) {
  return (
    '<section class="form-card">' +
    sectionTitle(
      "04",
      "How can a buyer reach you?",
      "These contact details will appear in your saved or shared ad.",
    ) +
    '<div class="form-grid">' +
    field("name", "Your name", {
      scope: "contact",
      required: true,
      max: 80,
      autocomplete: "name",
      placeholder: "Full name",
    }) +
    field("phone", "Mobile number", {
      scope: "contact",
      required: true,
      type: "tel",
      max: 25,
      autocomplete: "tel",
      placeholder: "03001234567",
      help: "Pakistani mobile number. +92 format is also accepted.",
    }) +
    field("sellerType", "You are a", {
      scope: "contact",
      options: ["Private seller", "Dealer"],
    }) +
    '<div class="field"><span>WhatsApp</span><label class="check-line" style="font-weight:400"><input type="checkbox" data-field="whatsapp" data-scope="contact"' +
    (ad.contact.whatsapp ? " checked" : "") +
    '> Buyers can contact me on WhatsApp at this number</label><small>A WhatsApp button opens a chat only when a buyer clicks it.</small></div></div><div class="info-box">No sign-in is needed for this test edition. This form does not verify your phone number or send an OTP. Your data stays on this device until you choose to download/share a copy.</div></section>'
  );
}
function wizardAside(ad, step) {
  const tips = [
    [
      "Start with the right identity.",
      "Select the car as it appears on your registration documents. You can type a variant if it is not in the suggestions.",
    ],
    [
      "Clear details save everyone time.",
      "Mention known faults, body repairs and maintenance. A full asking price makes the ad easier to compare.",
    ],
    [
      "Let buyers look around.",
      "Ordinary photos tell the story. Your 360 walk-around helps buyers inspect the car from more angles.",
    ],
    [
      "A direct way to get in touch.",
      "Use a phone number you can answer. Google sign-in and phone verification are not part of this test.",
    ],
  ][step - 1];
  return (
    '<aside class="wizard-aside"><div class="step-count">STEP ' +
    step +
    " OF 5</div><h2>" +
    esc(tips[0]) +
    "</h2><p>" +
    esc(tips[1]) +
    '</p><hr class="aside-rule"><div class="eyebrow" style="letter-spacing:1px">YOUR AD SO FAR</div><dl class="aside-summary"><dt>Car</dt><dd>' +
    esc(titleOf(ad)) +
    "</dd><dt>Location</dt><dd>" +
    esc(ad.details.city || "Not set yet") +
    '</dd><dt>Price</dt><dd id="aside-price">' +
    (ad.details.price ? "PKR " + money(ad.details.price) : "Not set yet") +
    '</dd><dt>Media</dt><dd id="media-count">' +
    ad.gallery.length +
    " photos · " +
    ad.studio.photos.length +
    " walk-around frames" +
    (ad.video ? " · 1 video" : "") +
    '</dd></dl><p style="margin-top:18px">Drafts save in this browser. You can come back through My ads.</p></aside>'
  );
}
function renderWizard(ad, step) {
  return (
    '<button class="back-link" data-action="garage">← My ads</button><div class="page-heading"><div><div class="eyebrow">GIVE BUYERS THE COMPLETE PICTURE</div><h1>' +
    (step === 5 ? "Preview your car ad." : "Create your car ad.") +
    '</h1><p>Your details, your photos, your 360 walk-around.</p></div><div class="heading-actions"><span class="pill draft-pill">DRAFT · ' +
    step +
    ' / 5</span><button class="btn small" data-action="save-draft">Save & exit</button></div></div><div class="stepper" aria-label="Ad creation steps">' +
    STEPS.map(
      (name, index) =>
        '<button data-action="step" data-step="' +
        (index + 1) +
        '" class="' +
        (step === index + 1 ? "active" : step > index + 1 ? "done" : "") +
        '"' +
        (step === index + 1 ? ' aria-current="step"' : "") +
        "><b>" +
        (step > index + 1 ? "✓" : index + 1) +
        "</b>" +
        esc(name) +
        "</button>",
    ).join("") +
    "</div>" +
    validationBox() +
    (step === 5
      ? '<div class="preview-banner"><span><b>This is your buyer preview.</b> Check the details and contact number before saving.</span><span class="pill">LOCAL PREVIEW</span></div><div class="detail-heading"><h2 style="font-size:26px;line-height:1.5">' +
        esc(titleOf(ad)) +
        "</h2><p>" +
        esc([ad.details.area, ad.details.city].filter(Boolean).join(", ")) +
        "</p></div>" +
        listingContent(ad, true)
      : '<div class="wizard-layout"><div class="wizard-main">' +
        [null, carStep, specsStep, mediaStep, contactStep][step](ad) +
        "</div>" +
        wizardAside(ad, step) +
        "</div>") +
    '<div class="wizard-footer"><button class="btn" data-action="' +
    (step === 1 ? "garage" : "previous") +
    '">← ' +
    (step === 1 ? "My ads" : "Back") +
    "</button><div>" +
    (step === 5
      ? '<button class="btn" data-action="edit" data-id="' +
        esc(ad.id) +
        '">Edit details</button><button class="btn primary" data-action="list-ad">Save to showroom →</button>'
      : '<button class="btn primary" data-action="next">' +
        (step === 4 ? "Preview ad" : "Save & continue") +
        " →</button>") +
    '</div></div><p class="single-intro">Test edition: showroom ads are visible in this browser. Download an ad copy to open or share it on another device.</p>'
  );
}
function card(ad) {
  const cover = coverOf(ad);
  return (
    '<article class="car-card" data-tilt="card"><button class="card-image" data-action="detail" data-id="' +
    esc(ad.id) +
    '" aria-label="View ' +
    esc(titleOf(ad)) +
    '">' +
    (cover
      ? '<img src="' +
        esc(cover) +
        '" alt="' +
        esc(titleOf(ad)) +
        '" loading="lazy">'
      : '<div class="empty-car">' + CAR_ART + "</div>") +
    (ad.studio.photos.length
      ? '<span class="pill image-pill">↔ ' +
        (ad.studio.loop ? "360° photo view" : "Photo walk-around") +
        "</span>"
      : "") +
    '</button><div class="car-card-body"><h3><button data-action="detail" data-id="' +
    esc(ad.id) +
    '">' +
    esc(titleOf(ad)) +
    '</button></h3><div class="price">PKR ' +
    money(ad.details.price) +
    '</div><p class="card-meta">' +
    esc(ad.details.city) +
    "<br>" +
    money(ad.details.mileage) +
    " km · " +
    esc(ad.details.fuel) +
    " · " +
    esc(ad.details.transmission) +
    '</p><div class="card-footer"><span>' +
    esc(ad.contact.sellerType || "Private seller") +
    '</span><button class="text-btn" data-action="detail" data-id="' +
    esc(ad.id) +
    '" style="font-size:10px">View car ↗</button></div></div></article>'
  );
}
function filteredAds() {
  let ads = appState.ads.filter((ad) => ad.status === "listed");
  return ads
    .filter((ad) => {
      const d = ad.details,
        query = (
          titleOf(ad) +
          " " +
          d.city +
          " " +
          d.description
        ).toLowerCase();
      return (
        (!filters.query || query.includes(filters.query.toLowerCase())) &&
        (!filters.city ||
          d.city.toLowerCase().includes(filters.city.toLowerCase())) &&
        (!filters.make || makeOf(ad) === filters.make) &&
        (!filters.minPrice || Number(d.price) >= Number(filters.minPrice)) &&
        (!filters.maxPrice || Number(d.price) <= Number(filters.maxPrice)) &&
        (!filters.minYear || Number(d.year) >= Number(filters.minYear)) &&
        (!filters.maxYear || Number(d.year) <= Number(filters.maxYear)) &&
        (!filters.fuel || d.fuel === filters.fuel) &&
        (!filters.transmission || d.transmission === filters.transmission) &&
        (!filters.maxMileage || Number(d.mileage) <= Number(filters.maxMileage))
      );
    })
    .sort((a, b) =>
      filters.sort === "price-low"
        ? Number(a.details.price) - Number(b.details.price)
        : filters.sort === "price-high"
          ? Number(b.details.price) - Number(a.details.price)
          : filters.sort === "mileage"
            ? Number(a.details.mileage) - Number(b.details.mileage)
            : b.updatedAt - a.updatedAt,
    );
}
function searchField(key, label, config = {}) {
  return (
    '<div class="field"><label for="search-' +
    key +
    '">' +
    esc(label) +
    "</label>" +
    (config.options
      ? '<select id="search-' +
        key +
        '" data-filter="' +
        key +
        '">' +
        options(config.options, filters[key], config.placeholder || "Any") +
        "</select>"
      : '<input id="search-' +
        key +
        '" data-filter="' +
        key +
        '" value="' +
        esc(filters[key]) +
        '" placeholder="' +
        esc(config.placeholder || "Any") +
        '"' +
        (config.numeric ? ' inputmode="numeric"' : "") +
        ">") +
    "</div>"
  );
}
function renderBrowse() {
  const ads = filteredAds();
  return (
    landingBackdrop() +
    '<section class="hero"><div class="hero-copy"><div class="hero-kicker"><i></i> 360° CAR SHOWROOM / PAKISTAN</div><h1>Your next car.<br><em>Every angle.</em></h1><p>Get closer before you get in. Explore the details, look around in 360, and find your next drive.</p><div class="hero-actions"><button class="btn primary" data-find-car>Find a car <span class="arrow-up" aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></span></button><button class="btn" data-action="new-ad">Sell your car <span aria-hidden="true">→</span></button></div><div class="hero-qualities"><span><b>↔</b> 360° walk-arounds</span><span><b>⊕</b> Detail zoom</span><span><b>▻</b> Photos + video</span></div></div>' +
    neonScene() +
    '</section><form id="search-form" class="search-card"><div class="search-grid">' +
    searchField("query", "Find a car", {
      placeholder: "Make, model or keyword",
    }) +
    searchField("city", "City", { placeholder: "Any city" }) +
    searchField("make", "Make", {
      options: Object.keys(CATALOG).sort(),
      placeholder: "All makes",
    }) +
    searchField("maxPrice", "Budget up to (PKR)", {
      numeric: true,
      placeholder: "Any budget",
    }) +
    '<button class="btn primary" type="submit">Search cars</button></div><div class="search-more"' +
    (filters.more ? "" : " hidden") +
    ">" +
    searchField("minPrice", "Minimum price (PKR)", { numeric: true }) +
    searchField("minYear", "Year from", { numeric: true }) +
    searchField("maxYear", "Year to", { numeric: true }) +
    searchField("fuel", "Fuel", { options: FUELS }) +
    searchField("transmission", "Transmission", { options: TRANSMISSIONS }) +
    searchField("maxMileage", "Mileage up to (km)", { numeric: true }) +
    '</div><div class="search-footer"><button class="text-btn" type="button" data-action="filters">' +
    (filters.more ? "Fewer filters" : "More filters") +
    '</button><button class="text-btn" type="button" data-action="reset-filters">Reset</button><span>Local showroom · ads saved in this browser</span></div></form><div class="results-top"><h2>' +
    ads.length +
    " " +
    (ads.length === 1 ? "car" : "cars") +
    ' to explore</h2><select id="sort-ads" aria-label="Sort cars">' +
    [
      ["newest", "Newest first"],
      ["price-low", "Price: low to high"],
      ["price-high", "Price: high to low"],
      ["mileage", "Lowest mileage"],
    ]
      .map(
        ([value, label]) =>
          '<option value="' +
          value +
          '"' +
          (filters.sort === value ? " selected" : "") +
          ">" +
          label +
          "</option>",
      )
      .join("") +
    "</select></div>" +
    (ads.length
      ? '<div class="car-grid">' + ads.map(card).join("") + "</div>"
      : '<div class="empty-state">' +
        CAR_ART +
        "<h2>" +
        (appState.ads.some((ad) => ad.status === "listed")
          ? "No cars match these filters."
          : "Your showroom starts with one car.") +
        "</h2><p>" +
        (appState.ads.some((ad) => ad.status === "listed")
          ? "Try a wider budget, another city or reset your filters."
          : "Create a car ad, add its photos and 360 view, then see the complete buyer experience here. No sign-in needed for this test.") +
        '</p><button class="btn primary" data-action="' +
        (appState.ads.some((ad) => ad.status === "listed")
          ? "reset-filters"
          : "new-ad") +
        '">' +
        (appState.ads.some((ad) => ad.status === "listed")
          ? "Reset filters"
          : "＋ Create your first ad") +
        "</button></div>") +
    '<div class="trust-row"><div><b>01 · Tell the whole story</b><p>Car details, condition, features and a clear asking price.</p></div><div><b>02 · Let buyers look around</b><p>Real photos and your existing interactive 360 viewer.</p></div><div><b>03 · Make a direct connection</b><p>Seller contact and an optional WhatsApp button.</p></div></div>'
  );
}
function renderGarage() {
  return (
    '<div class="page-heading"><div><div class="eyebrow">YOUR PERSONAL GARAGE</div><h1>My car ads.</h1><p>Drafts, showroom cars and sold cars—all saved on this device.</p></div><div class="heading-actions"><button class="btn" data-action="backup">Download backup</button><button class="btn primary" data-action="new-ad">＋ Add a car</button></div></div>' +
    (appState.ads.length
      ? appState.ads
          .slice()
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map(
            (ad) =>
              '<article class="garage-row">' +
              (coverOf(ad)
                ? '<img src="' +
                  esc(coverOf(ad)) +
                  '" alt="' +
                  esc(titleOf(ad)) +
                  '">'
                : '<div class="empty-car">' + CAR_ART + "</div>") +
              '<div><span class="pill ' +
              (ad.status === "draft"
                ? "draft-pill"
                : ad.status === "sold"
                  ? "sold-pill"
                  : "") +
              '">' +
              (ad.status === "draft"
                ? "DRAFT"
                : ad.status === "sold"
                  ? "SOLD"
                  : "IN LOCAL SHOWROOM") +
              "</span><h2>" +
              esc(titleOf(ad)) +
              "</h2><p>" +
              esc(ad.details.city || "Location pending") +
              " · " +
              (ad.details.price
                ? "PKR " + money(ad.details.price)
                : "Price pending") +
              "<br>Updated " +
              prettyDate(ad.updatedAt) +
              '</p></div><div class="garage-actions"><button class="btn small" data-action="edit" data-id="' +
              esc(ad.id) +
              '">' +
              (ad.status === "draft" ? "Continue draft" : "Edit ad") +
              '</button><button class="btn small" data-action="detail" data-id="' +
              esc(ad.id) +
              '">Preview</button>' +
              (ad.status === "listed"
                ? '<button class="btn small" data-action="sold" data-id="' +
                  esc(ad.id) +
                  '">Mark sold</button>'
                : "") +
              '<button class="btn small danger" data-action="delete-ad" data-id="' +
              esc(ad.id) +
              '">Delete</button></div></article>',
          )
          .join("")
      : '<div class="empty-state">' +
        CAR_ART +
        '<h2>A home for your first car ad.</h2><p>Create a draft now. Your photos, details and 360 walk-around stay together.</p><button class="btn primary" data-action="new-ad">Create an ad →</button></div>')
  );
}
function listingContent(ad, preview = false) {
  const d = ad.details,
    hasStudio = ad.studio.photos.length > 0,
    photos = listingPhotos(ad),
    use360 = hasStudio,
    phone = phoneNumber(ad.contact.phone);
  const specs = [
    ["Model year", d.year],
    ["Mileage", d.mileage ? money(d.mileage) + " km" : ""],
    ["Fuel", d.fuel],
    ["Transmission", d.transmission],
    [
      "Engine",
      d.fuel === "Electric" && !Number(d.engineCC)
        ? "Electric"
        : d.engineCC
          ? money(d.engineCC) + " cc"
          : "",
    ],
    ["Registered in", d.registration],
    ["Assembly", d.assembly],
    ["Colour", d.color],
    ["Body type", d.bodyType],
    ["Variant", d.variant],
  ];
  return (
    '<div class="listing-layout' +
    (preview ? " preview-layout" : "") +
    '"><div><div class="detail-gallery"><div class="detail-media-tabs"><button data-action="detail-photos" class="' +
    (!use360 && photos.length ? "active" : "") +
    '" id="detail-photos-tab">Photos (' +
    photos.length +
    ")</button>" +
    (hasStudio
      ? '<button data-action="detail-studio" class="' +
        (use360 ? "active" : "") +
        '" id="detail-studio-tab">↔ ' +
        (ad.studio.loop ? "360° photo view" : "Photo walk-around") +
        "</button>"
      : "") +
    (ad.video
      ? '<button data-action="detail-video" id="detail-video-tab" class="' +
        (!hasStudio && !photos.length ? "active" : "") +
        '">▷ Video</button>'
      : "") +
    '</div><div id="detail-photos"' +
    (use360 || (!photos.length && ad.video) ? " hidden" : "") +
    ">" +
    (photos.length
      ? '<img class="detail-image" id="detail-image" src="' +
        esc(photos[0].src) +
        '" alt="' +
        esc(titleOf(ad)) +
        '"><div class="detail-thumbs">' +
        photos
          .map(
            (photo, index) =>
              '<button data-action="detail-photo" data-index="' +
              index +
              '" class="' +
              (index === 0 ? "active" : "") +
              '" aria-label="View car photo ' +
              (index + 1) +
              '"><img src="' +
              esc(photo.thumb) +
              '" alt=""></button>',
          )
          .join("") +
        "</div>"
      : '<div class="empty-car" style="height:300px">' + CAR_ART + "</div>") +
    '</div><div id="detail-studio"' +
    (!use360 ? " hidden" : "") +
    '><div id="detail-studio-host"></div></div>' +
    (ad.video
      ? '<div id="detail-video"' +
        (photos.length || hasStudio ? " hidden" : "") +
        '><video id="detail-video-player" controls playsinline preload="metadata" src="' +
        esc(ad.video.src) +
        '"></video><p class="media-note">' +
        esc(ad.video.name) +
        " · Original seller video</p></div>"
      : "") +
    '<p class="media-inventory">' +
    ad.gallery.length +
    " ad photos · " +
    ad.studio.photos.length +
    " walk-around frames" +
    (ad.video ? " · 1 video" : "") +
    ' — included in this ad</p></div><section class="detail-copy"><h2>Car specifications</h2><dl class="spec-grid">' +
    specs
      .filter(([, value]) => value)
      .map(
        ([label, value]) =>
          "<div><dt>" + esc(label) + "</dt><dd>" + esc(value) + "</dd></div>",
      )
      .join("") +
    "</dl></section>" +
    (d.features.length
      ? '<section class="detail-copy"><h2>Features & equipment</h2><div class="feature-tags">' +
        d.features
          .map((feature) => "<span>✓ " + esc(feature) + "</span>")
          .join("") +
        "</div></section>"
      : "") +
    '<section class="detail-copy"><h2>Seller’s description</h2><p class="description">' +
    esc(d.description || "Description not added yet.") +
    '</p></section></div><aside class="contact-card"><span class="pill ' +
    (ad.status === "sold" ? "sold-pill" : "") +
    '">' +
    (ad.status === "sold"
      ? "SOLD"
      : preview || ad.status === "draft"
        ? "AD PREVIEW"
        : "LOCAL SHOWROOM") +
    '</span><div class="detail-price">' +
    (d.price ? "PKR " + money(d.price) : "Price pending") +
    '</div><div class="price-word">' +
    (d.price ? esc(priceWords(d.price)) : "") +
    (d.negotiable ? " · Negotiable" : "") +
    '</div><hr><span class="eyebrow" style="letter-spacing:1px">SELLER DETAILS</span><h3>' +
    esc(ad.contact.name || "Contact pending") +
    "</h3><p>" +
    esc(ad.contact.sellerType || "Private seller") +
    "<br>" +
    esc([d.area, d.city].filter(Boolean).join(", ")) +
    "</p>" +
    (phone && ad.status !== "sold"
      ? '<div id="revealed-contact" hidden><div class="contact-number">' +
        esc(ad.contact.phone) +
        '</div><a class="btn primary" href="tel:+' +
        phone +
        '">Call seller</a></div><button class="btn primary" data-action="show-phone" id="show-phone">Show phone number</button>' +
        (ad.contact.whatsapp
          ? '<a class="btn" href="https://wa.me/' +
            phone +
            '" target="_blank" rel="noopener noreferrer">Contact on WhatsApp ↗</a>'
          : "")
      : '<p style="margin-top:14px">' +
        (ad.status === "sold"
          ? "This car has been marked as sold."
          : "Add contact details to complete the ad.") +
        "</p>") +
    '<hr><p>Car details and condition are provided by the seller. Inspect the car and documents before making a purchase.</p><button class="text-btn" data-action="download-ad" data-id="' +
    esc(ad.id) +
    '">Download this ad</button><p style="margin-top:10px;font-size:10px">The HTML copy includes this ad’s photos, 360 view and contact details.</p></aside></div>'
  );
}
function renderDetail(ad) {
  return (
    '<button class="back-link" data-action="browse">← Explore cars</button><div class="detail-heading"><h1>' +
    esc(titleOf(ad)) +
    "</h1><p>" +
    esc([ad.details.area, ad.details.city].filter(Boolean).join(", ")) +
    " · Updated " +
    prettyDate(ad.updatedAt) +
    "</p></div>" +
    (ad.status === "draft"
      ? '<div class="preview-banner"><span><b>Private draft preview.</b> Complete your ad to add it to this browser’s showroom.</span><button class="btn small" data-action="edit" data-id="' +
        esc(ad.id) +
        '">Continue editing</button></div>'
      : "") +
    listingContent(ad) +
    '<div class="listing-actions" style="margin:20px 0"><button class="btn" data-action="edit" data-id="' +
    esc(ad.id) +
    '">Edit this ad</button><button class="btn" data-action="garage">My ads</button></div>'
  );
}
function render() {
  disposeHero();
  detachStudio();
  formErrors = formErrors || {};
  $("nav-browse").classList.toggle(
    "active",
    view.kind === "browse" || view.kind === "detail",
  );
  $("nav-garage").classList.toggle(
    "active",
    view.kind === "garage" || view.kind === "wizard",
  );
  const ad = currentAd();
  if ((view.kind === "wizard" || view.kind === "detail") && !ad)
    view = { kind: "browse" };
  document.title =
    ad && (view.kind === "wizard" || view.kind === "detail")
      ? titleOf(ad) + " · CarView Pakistan"
      : "CarView Pakistan · Your car, the complete picture";
  $("app").innerHTML =
    view.kind === "wizard"
      ? renderWizard(ad, view.step)
      : view.kind === "garage"
        ? renderGarage()
        : view.kind === "detail"
          ? renderDetail(ad)
          : renderBrowse();
  mountHero();
  if (view.kind === "wizard" && view.step === 3) {
    updateMediaSummary(ad);
    mountStudio($("studio-host"), ad);
  } else if (
    (view.kind === "detail" || (view.kind === "wizard" && view.step === 5)) &&
    ad.studio.photos.length &&
    !$("detail-studio").hidden
  )
    mountStudio($("detail-studio-host"), ad, true);
  if (Object.keys(formErrors).length) $("form-errors")?.focus();
}
async function navigate(next, skipCapture = false) {
  if (mediaBusy)
    throw new Error(
      "Let the photos finish preparing before leaving this step.",
    );
  if (!skipCapture) await captureStudio();
  await saveNow();
  view = next;
  formErrors = {};
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
}
function showFormErrors(ad, step, errors) {
  formErrors = errors;
  ad.step = step;
  persist(ad);
  if (view.kind === "wizard" && view.step === 3 && step === 3) {
    $("form-errors")?.remove();
    $("app")
      .querySelector(".wizard-layout")
      .insertAdjacentHTML("beforebegin", validationBox());
    $("form-errors").focus();
  } else {
    view = { kind: "wizard", id: ad.id, step };
    render();
  }
}
async function changeStep(step) {
  if (mediaBusy) throw new Error("Let the photos finish preparing first.");
  await captureStudio();
  const ad = currentAd();
  if (!ad) return;
  if (step > view.step) {
    for (let index = 1; index < step; index++) {
      const errors = validateStep(ad, index);
      if (Object.keys(errors).length) {
        showFormErrors(ad, index, errors);
        return;
      }
    }
  }
  ad.step = step;
  persist(ad);
  await navigate({ kind: "wizard", id: ad.id, step }, true);
}
function updateDependencies(key, ad) {
  if (key === "make") {
    ad.details.model = ad.details.make === "Other" ? "Other" : "";
    ad.details.customMake = "";
    ad.details.customModel = "";
    ad.details.variant = "";
    $("field-model").innerHTML = options(
      [...(CATALOG[ad.details.make] || []), "Other"],
      ad.details.model,
      "Select model",
    );
  }
  if (key === "model") {
    ad.details.customModel = "";
    ad.details.variant = "";
  }
  if (key === "make" || key === "model") {
    $("custom-make-wrap").hidden = ad.details.make !== "Other";
    $("custom-model-wrap").hidden = ad.details.model !== "Other";
    $("field-customMake").value = ad.details.customMake;
    $("field-customModel").value = ad.details.customModel;
    $("variants").innerHTML = (
      VARIANTS[ad.details.make + "|" + ad.details.model] || []
    )
      .map((value) => '<option value="' + esc(value) + '">')
      .join("");
    $("field-variant").value = "";
  }
}
function handleInput(event) {
  const element = event.target;
  if (element.matches("[data-filter]")) {
    filters[element.dataset.filter] = element.value.trim();
    return;
  }
  if (view.kind !== "wizard") return;
  const ad = currentAd();
  if (!ad) return;
  if (element.matches("[data-feature]")) {
    const feature = element.dataset.feature;
    if (!FEATURES.includes(feature)) return;
    ad.details.features = element.checked
      ? [...new Set([...ad.details.features, feature])]
      : ad.details.features.filter((value) => value !== feature);
    persist(ad);
    return;
  }
  const key = element.dataset.field,
    scope = element.dataset.scope;
  if (!key || !["details", "contact"].includes(scope) || !(key in ad[scope]))
    return;
  ad[scope][key] =
    element.type === "checkbox" ? element.checked : element.value;
  if (key === "make" || key === "model") updateDependencies(key, ad);
  if (key === "price") {
    if ($("price-words"))
      $("price-words").textContent = element.value
        ? "PKR " + priceWords(element.value)
        : "Your asking price";
    if ($("aside-price"))
      $("aside-price").textContent = element.value
        ? "PKR " + money(element.value)
        : "Not set yet";
  }
  if (formErrors[key]) {
    delete formErrors[key];
    element.closest(".field")?.classList.remove("error");
    element.removeAttribute("aria-invalid");
    $("error-" + key)?.remove();
    if ($("form-errors")) $("form-errors").outerHTML = validationBox();
  }
  persist(ad);
}
async function galleryPhoto(file) {
  if (file.size > 10 * 1024 * 1024) throw new Error("Maximum 10 MB per photo.");
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const jpeg = header[0] === 255 && header[1] === 216 && header[2] === 255,
    png = [137, 80, 78, 71, 13, 10, 26, 10].every(
      (value, index) => header[index] === value,
    ),
    webp =
      String.fromCharCode(...header.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...header.slice(8, 12)) === "WEBP";
  if (!jpeg && !png && !webp) throw new Error("Use a JPG, PNG or WebP image.");
  let image,
    cleanup = () => {};
  if (globalThis.createImageBitmap) {
    image = await createImageBitmap(file, { imageOrientation: "from-image" });
    cleanup = () => image.close();
  } else {
    const url = URL.createObjectURL(file);
    image = new Image();
    cleanup = () => URL.revokeObjectURL(url);
    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("Could not decode this image."));
        image.src = url;
      });
    } catch (error) {
      cleanup();
      throw error;
    }
  }
  try {
    if (!image.width || !image.height || image.width * image.height > 40000000)
      throw new Error("Maximum 40 megapixels.");
    const canvas = document.createElement("canvas"),
      scale = Math.min(1, 1600 / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const src = canvas.toDataURL("image/jpeg", 0.88);
    const thumb = document.createElement("canvas"),
      ratio = Math.min(1, 220 / Math.max(canvas.width, canvas.height));
    thumb.width = Math.max(1, Math.round(canvas.width * ratio));
    thumb.height = Math.max(1, Math.round(canvas.height * ratio));
    thumb.getContext("2d").drawImage(canvas, 0, 0, thumb.width, thumb.height);
    return {
      id: uid(),
      name: file.name.slice(0, 180),
      src,
      thumb: thumb.toDataURL("image/jpeg", 0.75),
    };
  } finally {
    cleanup();
  }
}
async function addGallery(files) {
  const ad = currentAd();
  if (!ad || mediaBusy) return;
  const remaining = 20 - ad.gallery.length;
  if (!remaining) {
    toast("This ad already has 20 photos. Remove one before adding more.");
    return;
  }
  const selected = Array.from(files).slice(0, remaining);
  if (!selected.length) return;
  mediaBusy = true;
  $("photo-busy").hidden = false;
  const errors = [];
  try {
    for (let index = 0; index < selected.length; index++) {
      $("photo-busy").textContent =
        "Preparing photo " + (index + 1) + " of " + selected.length + "…";
      try {
        ad.gallery.push(await galleryPhoto(selected[index]));
      } catch (error) {
        errors.push(selected[index].name + ": " + error.message);
      }
    }
    $("gallery-grid").innerHTML = galleryItems(ad);
    updateMediaSummary(ad);
    persist(ad);
    toast(
      errors.length
        ? "Some photos could not be added: " + errors.slice(0, 2).join(" · ")
        : selected.length + " photos ready. The first photo is your ad cover.",
    );
  } finally {
    mediaBusy = false;
    $("photo-busy").hidden = true;
    $("gallery-files").value = "";
  }
}
function videoEditor(ad) {
  return ad.video
    ? '<video class="ad-video-preview" controls playsinline preload="metadata" src="' +
        esc(ad.video.src) +
        '"></video><div class="video-file-row"><span>' +
        esc(ad.video.name) +
        ' · Saved with this ad</span><button class="btn small danger" data-action="remove-video">Remove video</button></div>'
    : '<p class="media-note">No original video added yet. Choosing a video in the 360 studio also saves it here when it is 50 MB or smaller.</p>';
}
function hideDetailVideo() {
  $("detail-video-player")?.pause();
  if ($("detail-video")) $("detail-video").hidden = true;
  $("detail-video-tab")?.classList.remove("active");
}
async function addVideo(file, ad = currentAd()) {
  if (!file || !ad) return;
  if (mediaBusy)
    throw new Error(
      "Let the current media finish saving, then add the video again.",
    );
  if (file.size > MAX_AD_VIDEO)
    throw new Error(
      "Original videos save in the ad up to 50 MB. Shorten this clip for video playback; its 360 frames can still be created in the studio.",
    );
  if (!file.size) throw new Error("This video file is empty.");
  const name = String(file.name || "Car video.mp4");
  const extension = name.split(".").pop().toLowerCase();
  const mime = {
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    m4v: "video/x-m4v",
  }[extension];
  if (!mime)
    throw new Error(
      "Use an MP4, WebM, MOV or M4V video. MP4/H.264 plays on most devices.",
    );
  mediaBusy = true;
  const editor = $("ad-video-editor");
  if (editor)
    editor.insertAdjacentHTML(
      "afterbegin",
      '<p class="media-note" id="video-saving" role="status">Saving original video with your ad…</p>',
    );
  const url = URL.createObjectURL(file),
    video = document.createElement("video");
  let timeout;
  try {
    await new Promise((resolve, reject) => {
      timeout = setTimeout(
        () =>
          reject(new Error("Video preview timed out. Try an MP4/H.264 clip.")),
        15000,
      );
      video.preload = "metadata";
      video.onloadedmetadata = () =>
        video.videoWidth &&
        video.videoHeight &&
        Number.isFinite(video.duration) &&
        video.duration > 0
          ? resolve()
          : reject(new Error("This clip has no playable video track."));
      video.onerror = () =>
        reject(
          new Error(
            "This browser cannot play that video. Use an MP4/H.264 clip.",
          ),
        );
      video.src = url;
    });
    clearTimeout(timeout);
    // Capture a cover for video-only ads; the original clip is kept untouched.
    let poster = "";
    await new Promise((resolve) => {
      timeout = setTimeout(resolve, 5000);
      video.onseeked = () => {
        clearTimeout(timeout);
        resolve();
      };
      video.currentTime = Math.min(0.15, video.duration / 2);
    });
    if (video.readyState >= 2) {
      const canvas = document.createElement("canvas");
      const scale = Math.min(
        1,
        640 / Math.max(video.videoWidth, video.videoHeight),
      );
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      canvas
        .getContext("2d")
        .drawImage(video, 0, 0, canvas.width, canvas.height);
      poster = canvas.toDataURL("image/jpeg", 0.78);
    }
    const src = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () =>
        reject(new Error("The video could not be read. Please try again."));
      reader.readAsDataURL(file.slice(0, file.size, mime));
    });
    ad.video = cleanVideo({ name, src, poster });
    persist(ad);
    updateMediaSummary(ad);
    if (editor?.isConnected) editor.innerHTML = videoEditor(ad);
    toast(
      "Original video saved. It will appear in the preview and published ad’s Video tab.",
    );
  } finally {
    clearTimeout(timeout);
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
    mediaBusy = false;
    $("video-saving")?.remove();
  }
}
async function importStudio(file) {
  if (!file || view.kind !== "wizard" || view.step !== 3) return;
  if (file.size > 100 * 1024 * 1024)
    throw new Error(
      "This saved HTML is over 100 MB. Use a smaller saved sequence.",
    );
  await captureStudio();
  const ad = currentAd();
  const parsed = new DOMParser().parseFromString(
      await file.text(),
      "text/html",
    ),
    data = parsed.getElementById("carview-data");
  if (!data)
    throw new Error(
      "Choose a saved CarView 360 HTML file, not a different webpage.",
    );
  const project = cleanStudio(JSON.parse(data.textContent));
  if (
    ad.studio.photos.length &&
    !confirm("Replace the current 360 sequence with this saved one?")
  )
    return;
  project.id = uid();
  ad.studio = project;
  persist(ad);
  render();
  toast(project.photos.length + " saved 360 frames added.");
}
function downloadState(ads, startId = null, home = false) {
  const copy = new DOMParser().parseFromString(PRISTINE_TEMPLATE, "text/html");
  const payload = {
    version: 1,
    ads: structuredClone(ads),
    showroom: structuredClone(appState.showroom || blankShowroom()),
    copyId: uid(),
    startId,
    startView: home || startId ? null : "garage",
  };
  copy.getElementById("marketplace-data").textContent = jsonSafe(payload);
  const blob = new Blob(["<!doctype html>\n", copy.documentElement.outerHTML], {
      type: "text/html;charset=utf-8",
    }),
    url = URL.createObjectURL(blob),
    link = document.createElement("a");
  const ad = startId ? ads.find((ad) => ad.id === startId) : null;
  const filename = ad
    ? titleOf(ad)
        .replace(/[^a-zA-Z0-9 _-]/g, "")
        .slice(0, 65)
    : home
      ? "CarView-Pakistan-App"
      : "CarView-My-Ads";
  link.href = url;
  link.download = (filename || "CarView-Ad") + ".html";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  toast(
    ad
      ? "Ad copy download started. It includes the photos, 360 view and seller contact."
      : home
        ? "App copy download started. Your ads and media are included."
        : "Backup download started. It includes all your ads, photos and contact details.",
  );
}
async function action(button) {
  const kind = button.dataset.action,
    id = button.dataset.id,
    ad = currentAd();
  if (mediaBusy) throw new Error("Let the photos finish preparing first.");
  if (kind === "save-showroom") {
    downloadState(appState.ads, null, true);
    return;
  }
  if (kind === "browse") return navigate({ kind: "browse" });
  if (kind === "garage" || kind === "save-draft") {
    await navigate({ kind: "garage" });
    if (kind === "save-draft") toast("Your draft is in My ads.");
    return;
  }
  if (kind === "new-ad") {
    await captureStudio();
    if (appState.ads.length >= 25)
      throw new Error(
        "This local garage supports 25 ads. Back up and remove old ads before adding more.",
      );
    const created = newAd();
    appState.ads.unshift(created);
    persist(created);
    return navigate({ kind: "wizard", id: created.id, step: 1 }, true);
  }
  if (kind === "edit") {
    await captureStudio();
    const target = appState.ads.find((ad) => ad.id === id);
    if (!target) return;
    if (target.status !== "draft") {
      target.status = "draft";
      persist(target);
      toast(
        "Moved to drafts while you edit. Review and save it to the showroom again when ready.",
      );
    }
    return navigate({ kind: "wizard", id, step: target.step || 1 }, true);
  }
  if (kind === "detail") return navigate({ kind: "detail", id });
  if (kind === "next") return changeStep(Math.min(5, view.step + 1));
  if (kind === "previous") return changeStep(Math.max(1, view.step - 1));
  if (kind === "step")
    return changeStep(
      Math.max(1, Math.min(5, Number(button.dataset.step) || 1)),
    );
  if (kind === "choose-gallery") {
    $("gallery-files").click();
    return;
  }
  if (kind === "choose-video") {
    $("ad-video-files").click();
    return;
  }
  if (kind === "remove-video") {
    if (
      ad &&
      confirm(
        "Remove the original video from this ad? The 360 frames are kept.",
      )
    ) {
      ad.video = null;
      persist(ad);
      $("ad-video-editor").innerHTML = videoEditor(ad);
      updateMediaSummary(ad);
    }
    return;
  }
  if (kind === "cover" || kind === "remove-photo") {
    const index = Number(button.dataset.index);
    if (!ad || !Number.isInteger(index) || !ad.gallery[index]) return;
    const [photo] = ad.gallery.splice(index, 1);
    if (kind === "cover") ad.gallery.unshift(photo);
    $("gallery-grid").innerHTML = galleryItems(ad);
    updateMediaSummary(ad);
    persist(ad);
    return;
  }
  if (kind === "import-studio") {
    $("studio-import").click();
    return;
  }
  if (kind === "list-ad") {
    await captureStudio();
    const invalid = allErrors(ad);
    if (invalid) {
      showFormErrors(ad, invalid.step, invalid.errors);
      return;
    }
    ad.status = "listed";
    ad.step = 5;
    persist(ad);
    await navigate({ kind: "detail", id: ad.id }, true);
    toast(
      "Your ad is in this browser’s showroom. Download an ad copy to share or open elsewhere.",
    );
    return;
  }
  if (kind === "delete-ad") {
    const target = appState.ads.find((ad) => ad.id === id);
    if (
      !target ||
      !confirm(
        "Delete this ad and its saved photos from this browser? " +
          titleOf(target),
      )
    )
      return;
    appState.ads = appState.ads.filter((ad) => ad.id !== id);
    persist();
    return navigate({ kind: "garage" });
  }
  if (kind === "sold") {
    const target = appState.ads.find((ad) => ad.id === id);
    if (target) {
      target.status = "sold";
      persist(target);
      render();
      toast("Marked as sold. It is no longer shown in Explore cars.");
    }
    return;
  }
  if (kind === "backup") {
    await captureStudio();
    downloadState(appState.ads);
    return;
  }
  if (kind === "download-ad") {
    await captureStudio();
    const target = appState.ads.find((ad) => ad.id === id);
    if (target) downloadState([target], target.id);
    return;
  }
  if (kind === "filters") {
    filters.more = !filters.more;
    $("app").querySelector(".search-more").hidden = !filters.more;
    button.textContent = filters.more ? "Fewer filters" : "More filters";
    return;
  }
  if (kind === "reset-filters") {
    for (const key of Object.keys(filters))
      filters[key] = key === "sort" ? "newest" : key === "more" ? false : "";
    render();
    return;
  }
  if (kind === "show-phone") {
    $("revealed-contact").hidden = false;
    button.hidden = true;
    return;
  }
  if (kind === "detail-photos") {
    detachStudio();
    $("detail-studio-host")?.replaceChildren();
    $("detail-studio").hidden = true;
    $("detail-photos").hidden = false;
    $("detail-photos-tab").classList.add("active");
    $("detail-studio-tab")?.classList.remove("active");
    hideDetailVideo();
    return;
  }
  if (kind === "detail-studio") {
    $("detail-photos").hidden = true;
    $("detail-studio").hidden = false;
    $("detail-studio-tab").classList.add("active");
    $("detail-photos-tab").classList.remove("active");
    hideDetailVideo();
    if (!activeStudio) mountStudio($("detail-studio-host"), ad, true);
    return;
  }
  if (kind === "detail-video") {
    detachStudio();
    $("detail-studio-host")?.replaceChildren();
    $("detail-studio").hidden = true;
    $("detail-photos").hidden = true;
    $("detail-studio-tab")?.classList.remove("active");
    $("detail-photos-tab").classList.remove("active");
    $("detail-video").hidden = false;
    $("detail-video-tab").classList.add("active");
    return;
  }
  if (kind === "detail-photo") {
    const photos = listingPhotos(ad),
      index = Number(button.dataset.index);
    if (!photos[index]) return;
    $("detail-image").src = photos[index].src;
    document
      .querySelectorAll(".detail-thumbs button")
      .forEach((element, i) => element.classList.toggle("active", i === index));
    return;
  }
}
async function boot() {
  let embedded = null,
    warning = "";
  try {
    const value = JSON.parse($("marketplace-data").textContent);
    if (value) {
      embedded = cleanState(value);
      appState = embedded;
      marketStorageKey = "copy:" + (embedded.copyId || uid());
    }
  } catch (error) {
    warning = "The saved app data could not be read: " + error.message;
  }
  try {
    database = await openDatabase();
    const saved = await storedState();
    if (saved) appState = cleanState(saved);
    storageLabel("Saved on this device");
  } catch (error) {
    if (database) database.close();
    database = null;
    storageLabel("Session only · download your ad/backup before closing");
    warning =
      warning ||
      "Browser storage is unavailable. You can test everything, then download your ad or a backup before closing.";
  }
  if (appState.startId && appState.ads.some((ad) => ad.id === appState.startId))
    view = { kind: "detail", id: appState.startId };
  else if (appState.startView === "garage") view = { kind: "garage" };
  window.addEventListener("message", studioMessage);
  installEffects();
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (button && !button.disabled) {
      event.preventDefault();
      void action(button).catch((error) => toast(error.message));
    }
  });
  $("app").addEventListener("input", (event) => {
    if (event.target.tagName !== "SELECT") handleInput(event);
  });
  $("app").addEventListener("change", (event) => {
    if (event.target.tagName === "SELECT") handleInput(event);
    if (event.target.id === "sort-ads") {
      filters.sort = event.target.value;
      render();
    }
  });
  $("app").addEventListener("submit", (event) => {
    event.preventDefault();
    if (event.target.id === "search-form") {
      render();
      $("app")
        .querySelector(".results-top")
        ?.scrollIntoView({ block: "start" });
    }
  });
  $("gallery-files").onchange = (event) => {
    void addGallery(event.target.files).catch((error) => toast(error.message));
  };
  $("ad-video-files").onchange = (event) => {
    const file = event.target.files[0];
    if (file) void addVideo(file).catch((error) => toast(error.message));
    event.target.value = "";
  };
  $("studio-import").onchange = (event) => {
    void importStudio(event.target.files[0])
      .catch((error) => toast(error.message))
      .finally(() => ($("studio-import").value = ""));
  };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && saveTimer) void saveNow();
  });
  window.addEventListener("pagehide", () => {
    if (saveTimer) void saveNow();
  });
  render();
  document.documentElement.dataset.ready = "true";
  if (warning) toast(warning);
  if (embedded) persist();
}
void boot();
