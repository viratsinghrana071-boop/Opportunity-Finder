import { fetchAllOpportunities } from "./data/opportunities.js";

const PAGE_SIZE = 12;

const classLabels = {
  "9": "Grade 9",
  "10": "Grade 10",
  "11": "Grade 11",
  "12": "Grade 12",
  undergraduate: "Undergraduate",
  postgraduate: "Postgraduate",
  professional: "Early career",
  open: "Open to all"
};

const categoryNames = {
  scholarships: "scholarship",
  competitions: "competition",
  programs: "program",
  internships: "internship",
  fellowships: "fellowship",
  volunteer: "volunteer",
  other: "other"
};

let opportunities = [];
let pageIndex = 0;

function qs(name) {
  return new URLSearchParams(location.search).get(name) || "";
}

function pageType() {
  return document.body.getAttribute("data-page") || "home";
}

function formatDeadline(deadline) {
  const date = new Date(String(deadline) + "T00:00:00");
  if (Number.isNaN(date.getTime())) return deadline || "Rolling / open";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function labelClasses(item) {
  const levels = item.classLevels?.length ? item.classLevels : [item.classLevel || "open"];
  return levels.map((level) => classLabels[level] || level).join(" · ");
}

function matchesClass(item, classLevel) {
  if (!classLevel) return true;
  const levels = item.classLevels?.length ? item.classLevels : [item.classLevel];
  if (levels.includes(classLevel) || levels.includes("open")) return true;
  if (classLevel === "high-school") {
    return ["9", "10", "11", "12", "open"].some((g) => levels.includes(g));
  }
  if (classLevel === "university") {
    return ["undergraduate", "postgraduate", "open"].some((g) => levels.includes(g));
  }
  return false;
}

function el(id) {
  return document.getElementById(id);
}

function createOpportunityCard(opportunity) {
  const card = document.createElement("article");
  card.className = "opportunity-card" + (opportunity.expired ? " is-expired" : "");

  if (opportunity.image) {
    const media = document.createElement("div");
    media.className = "opportunity-media";
    const img = document.createElement("img");
    img.src = opportunity.image;
    img.alt = "";
    img.loading = "lazy";
    media.appendChild(img);
    card.appendChild(media);
  }

  const tags = document.createElement("div");
  tags.className = "card-tags";

  const category = document.createElement("span");
  category.className = "opportunity-tag";
  category.textContent = opportunity.category;
  tags.appendChild(category);

  const source = document.createElement("span");
  source.className = "source-pill";
  source.textContent = opportunity.source || "Live";
  tags.appendChild(source);

  if (opportunity.expired) {
    const expired = document.createElement("span");
    expired.className = "status-badge";
    expired.textContent = "Deadline hit";
    tags.appendChild(expired);
  }

  card.appendChild(tags);

  const title = document.createElement("h3");
  title.className = "opportunity-title";
  title.textContent = opportunity.title;
  card.appendChild(title);

  const organizer = document.createElement("p");
  organizer.className = "opportunity-organizer";
  organizer.textContent = opportunity.organizer;
  card.appendChild(organizer);

  const description = document.createElement("p");
  description.className = "opportunity-description";
  description.textContent = opportunity.description;
  card.appendChild(description);

  const meta = document.createElement("div");
  meta.className = "card-meta";
  meta.innerHTML =
    "<span>" + (opportunity.country || "Worldwide") + "</span>" +
    "<span>" + (opportunity.format || "online") + "</span>" +
    "<span>" + labelClasses(opportunity) + "</span>";
  card.appendChild(meta);

  const deadline = document.createElement("p");
  deadline.className = "opportunity-deadline";
  deadline.textContent = opportunity.expired
    ? "Expired: " + formatDeadline(opportunity.deadline)
    : "Deadline: " + formatDeadline(opportunity.deadline);
  card.appendChild(deadline);

  const detailsButton = document.createElement("button");
  detailsButton.type = "button";
  detailsButton.className = "opportunity-link";
  detailsButton.textContent = opportunity.expired ? "View anyway" : "View details";
  detailsButton.addEventListener("click", () => openDetailsModal(opportunity.id));
  card.appendChild(detailsButton);

  return card;
}

function findOpportunityById(id) {
  return opportunities.find((item) => String(item.id) === String(id)) || null;
}

function openDetailsModal(id) {
  const opportunity = findOpportunityById(id);
  const detailsModal = el("details-modal");
  if (!opportunity || !detailsModal) return;

  el("modal-title").textContent = opportunity.title;
  el("modal-organizer").textContent = "Organizer: " + opportunity.organizer;
  el("modal-category").textContent = opportunity.category;
  el("modal-description").textContent = opportunity.description;
  el("modal-eligibility").textContent = "Eligibility: " + opportunity.eligibility;
  el("modal-deadline").textContent = (opportunity.expired ? "Deadline hit: " : "Deadline: ") + formatDeadline(opportunity.deadline);
  el("modal-location").textContent = "Location: " + opportunity.location;
  if (el("modal-country")) el("modal-country").textContent = "Country: " + (opportunity.country || "Worldwide");
  if (el("modal-class")) el("modal-class").textContent = "Who can apply: " + labelClasses(opportunity);
  if (el("modal-source")) el("modal-source").textContent = "Live source: " + (opportunity.source || "Feed");
  if (el("modal-status")) {
    el("modal-status").hidden = !opportunity.expired;
    el("modal-status").textContent = "Deadline hit · stays 2 days";
  }
  el("modal-apply").href = opportunity.officialUrl;

  detailsModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeDetailsModal() {
  const detailsModal = el("details-modal");
  if (!detailsModal) return;
  detailsModal.hidden = true;
  document.body.classList.remove("modal-open");
}

function currentFilters() {
  const presetCategory = document.body.getAttribute("data-category") || qs("type");
  const presetClass = document.body.getAttribute("data-class") || qs("class");
  const presetStatus = document.body.getAttribute("data-status") || qs("status");
  return {
    search: el("search-input")?.value.trim() || qs("q"),
    category: el("filter-category")?.value || presetCategory,
    country: el("filter-country")?.value || "",
    classLevel: el("filter-class")?.value || presetClass,
    format: el("filter-format")?.value || "",
    region: el("filter-region")?.value || "",
    status: el("filter-status")?.value || presetStatus || "all",
    window: el("filter-window")?.value || ""
  };
}

function withinWindow(item, window) {
  if (!window) return true;
  const date = new Date(String(item.deadline) + "T00:00:00");
  if (Number.isNaN(date.getTime())) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = (date - today) / (24 * 60 * 60 * 1000);
  if (window === "week") return diff >= 0 && diff <= 7;
  if (window === "month") return diff >= 0 && diff <= 30;
  if (window === "later") return diff > 30;
  return true;
}

function getVisibleOpportunities() {
  const filters = currentFilters();
  const page = pageType();

  return opportunities.filter((item) => {
    if (page === "home") return !item.expired;
    if (page === "high-school") {
      const ok = matchesClass(item, "high-school");
      if (!ok) return false;
    }
    if (page === "university") {
      if (!matchesClass(item, "university")) return false;
    }
    if (page === "expired" && !item.expired) return false;

    const searchOk = !filters.search || [
      item.title, item.category, item.organizer, item.description,
      item.location, item.country, item.eligibility, item.source
    ].join(" ").toLowerCase().includes(filters.search.toLowerCase());

    const mapped = categoryNames[filters.category] || filters.category;
    const categoryOk = !mapped || item.category === mapped;
    const countryOk = !filters.country || item.country === filters.country;
    const classOk = matchesClass(item, filters.classLevel);
    const formatOk = !filters.format || item.format === filters.format;
    const regionOk = !filters.region || item.region === filters.region;
    const statusOk =
      filters.status === "expired" ? item.expired :
      filters.status === "open" ? !item.expired : true;
    const windowOk = withinWindow(item, filters.window);

    return searchOk && categoryOk && countryOk && classOk && formatOk && regionOk && statusOk && windowOk;
  });
}

function fillSelect(select, values, label) {
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">' + label + "</option>";
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
  if ([...select.options].some((opt) => opt.value === current)) select.value = current;
}

function fillFilters() {
  fillSelect(el("filter-country"), [...new Set(opportunities.map((i) => i.country).filter(Boolean))].sort(), "All countries");
  fillSelect(el("filter-region"), [...new Set(opportunities.map((i) => i.region).filter(Boolean))].sort(), "All regions");
  const presetCategory = document.body.getAttribute("data-category") || qs("type");
  const presetClass = document.body.getAttribute("data-class") || qs("class");
  const presetStatus = document.body.getAttribute("data-status");
  if (el("filter-category") && presetCategory) el("filter-category").value = categoryNames[presetCategory] || presetCategory;
  if (el("filter-class") && presetClass) el("filter-class").value = presetClass;
  if (el("filter-status") && presetStatus) el("filter-status").value = presetStatus;
  if (el("search-input") && qs("q")) el("search-input").value = qs("q");
}

function updateStats() {
  const open = opportunities.filter((item) => !item.expired).length;
  const expired = opportunities.filter((item) => item.expired).length;
  const countries = new Set(opportunities.map((item) => item.country).filter(Boolean));
  if (el("stat-open")) el("stat-open").textContent = String(open);
  if (el("stat-expired")) el("stat-expired").textContent = String(expired);
  if (el("stat-countries")) el("stat-countries").textContent = String(countries.size);
}

function renderPager(total) {
  const pager = el("pager");
  if (!pager) return;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  pageIndex = Math.min(pageIndex, pages - 1);
  pager.innerHTML = "";
  if (pages <= 1) return;

  const prev = document.createElement("button");
  prev.type = "button";
  prev.className = "ghost-button";
  prev.textContent = "Previous";
  prev.disabled = pageIndex === 0;
  prev.addEventListener("click", () => { pageIndex -= 1; updateDisplay(); });

  const info = document.createElement("span");
  info.className = "pager-info";
  info.textContent = "Page " + (pageIndex + 1) + " of " + pages;

  const next = document.createElement("button");
  next.type = "button";
  next.className = "ghost-button";
  next.textContent = "Next";
  next.disabled = pageIndex >= pages - 1;
  next.addEventListener("click", () => { pageIndex += 1; updateDisplay(); });

  pager.append(prev, info, next);
}

function updateDisplay() {
  const list = el("opportunity-list");
  if (!list) return;
  const visible = getVisibleOpportunities();
  const page = pageType();
  const slice = page === "home" ? visible.slice(0, 6) : visible.slice(pageIndex * PAGE_SIZE, pageIndex * PAGE_SIZE + PAGE_SIZE);

  list.innerHTML = "";
  if (!slice.length) {
    const message = document.createElement("p");
    message.className = "about-text";
    message.textContent = "No live opportunities match these filters right now. Clear filters or try another page.";
    list.appendChild(message);
  } else {
    slice.forEach((item) => list.appendChild(createOpportunityCard(item)));
  }  

  if (el("results-meta")) {
    const stamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    el("results-meta").textContent = visible.length + " live listings · updated " + stamp + " · expired cards stay 2 days";
  }

  renderPager(page === "home" ? 1 : visible.length);
  document.querySelectorAll(".category-card").forEach((card) => {
    const value = categoryNames[card.getAttribute("data-category")] || card.getAttribute("data-category") || "";
    card.classList.toggle("is-active", value === currentFilters().category);
  });
}

async function loadOpportunities() {
  if (el("results-meta")) el("results-meta").textContent = "Fetching live worldwide listings…";
  try {
    opportunities = await fetchAllOpportunities();
  } catch (error) {
    opportunities = [];
    if (el("results-meta")) el("results-meta").textContent = "Live APIs are unreachable. Start the site with npm start.";
  }
  updateStats();
  fillFilters();
  updateDisplay();
}

function bindFilters() {
  ["filter-category", "filter-country", "filter-class", "filter-format", "filter-region", "filter-status", "filter-window"].forEach((id) => {
    el(id)?.addEventListener("change", () => { pageIndex = 0; updateDisplay(); });
  });
  el("search-input")?.addEventListener("input", () => { pageIndex = 0; updateDisplay(); });
  el("search-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const q = el("search-input")?.value.trim();
    if (pageType() === "home" && q) {
      location.href = "browse.html?q=" + encodeURIComponent(q);
      return;
    }
    pageIndex = 0;
    updateDisplay();
  });
  el("clear-filters")?.addEventListener("click", () => {
    ["filter-category", "filter-country", "filter-class", "filter-format", "filter-region", "filter-status", "filter-window"].forEach((id) => {
      if (el(id) && !document.body.getAttribute("data-category") && !document.body.getAttribute("data-class") && !document.body.getAttribute("data-status")) {
        el(id).value = "";
      } else if (el(id) && !["filter-category", "filter-class", "filter-status"].includes(id)) {
        el(id).value = "";
      }
    });
    if (el("search-input")) el("search-input").value = "";
    pageIndex = 0;
    updateDisplay();
  });
  el("refresh-button")?.addEventListener("click", loadOpportunities);
  el("modal-close")?.addEventListener("click", closeDetailsModal);
  el("details-modal")?.addEventListener("click", (event) => {
    if (event.target === el("details-modal")) closeDetailsModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDetailsModal();
  });
}

function setActiveNav() {
  const page = pageType();
  document.querySelectorAll(".nav-link").forEach((link) => {
    const href = link.getAttribute("href") || "";
    const isActive =
      (page === "home" && href === "index.html") ||
      (page === "browse" && href === "browse.html") ||
      (page === "high-school" && href === "high-school.html") ||
      (page === "university" && href === "university.html") ||
      (page === "expired" && href === "expired.html") ||
      (page === "about" && href === "about.html");
    link.classList.toggle("is-current", isActive);
  });
}

setActiveNav();
bindFilters();
if (el("opportunity-list")) {
  loadOpportunities();
  setInterval(loadOpportunities, 5 * 60 * 1000);
}
