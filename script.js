/*
  Opportunity Finder — homepage script
  ------------------------------------
  opportunities.js is loaded first, so the "opportunities" array
  is already available here.

  index.html uses these ids:
  - #opportunity-list  (the card container)
  - #search-input      (the search box)
  - #search-form       (so the page does not reload on Search)
  - #category-list     (category buttons)
  - #details-modal     (opportunity details popup)
*/

const opportunityContainer = document.getElementById("opportunity-list");
const searchInput = document.getElementById("search-input");
const searchForm = document.getElementById("search-form");
const categoryLinks = document.querySelectorAll(".category-link");
const detailsModal = document.getElementById("details-modal");
const modalClose = document.getElementById("modal-close");
const modalTitle = document.getElementById("modal-title");
const modalOrganizer = document.getElementById("modal-organizer");
const modalCategory = document.getElementById("modal-category");
const modalDescription = document.getElementById("modal-description");
const modalEligibility = document.getElementById("modal-eligibility");
const modalDeadline = document.getElementById("modal-deadline");
const modalLocation = document.getElementById("modal-location");
const modalApply = document.getElementById("modal-apply");

// The HTML uses plural names (scholarships). The data uses singular (scholarship).
const categoryNames = {
  scholarships: "scholarship",
  competitions: "competition",
  programs: "program",
  internships: "internship"
};

// Empty string means "show every category".
let selectedCategory = "";

function formatDeadline(deadline) {
  const date = new Date(deadline + "T00:00:00");

  if (Number.isNaN(date.getTime())) {
    return deadline;
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function createOpportunityCard(opportunity) {
  const card = document.createElement("article");
  card.className = "opportunity-card";

  const category = document.createElement("span");
  category.className = "opportunity-tag";
  category.textContent = opportunity.category;
  card.appendChild(category);

  const title = document.createElement("h3");
  title.className = "opportunity-title";
  title.textContent = opportunity.title;
  card.appendChild(title);

  const organizer = document.createElement("p");
  organizer.textContent = "Organizer: " + opportunity.organizer;
  card.appendChild(organizer);

  const description = document.createElement("p");
  description.className = "opportunity-description";
  description.textContent = opportunity.description;
  card.appendChild(description);

  const eligibility = document.createElement("p");
  eligibility.textContent = "Eligibility: " + opportunity.eligibility;
  card.appendChild(eligibility);

  const deadline = document.createElement("p");
  deadline.className = "opportunity-deadline";
  deadline.textContent = "Deadline: " + formatDeadline(opportunity.deadline);
  card.appendChild(deadline);

  const location = document.createElement("p");
  location.textContent = "Location: " + opportunity.location;
  card.appendChild(location);

  const detailsButton = document.createElement("button");
  detailsButton.type = "button";
  detailsButton.className = "opportunity-link";
  detailsButton.textContent = "View Details";
  detailsButton.setAttribute("data-id", opportunity.id);
  detailsButton.addEventListener("click", function () {
    openDetailsModal(opportunity.id);
  });
  card.appendChild(detailsButton);

  return card;
}

function findOpportunityById(id) {
  for (let i = 0; i < opportunities.length; i++) {
    if (opportunities[i].id === id) {
      return opportunities[i];
    }
  }

  return null;
}

function openDetailsModal(id) {
  const opportunity = findOpportunityById(id);

  if (!opportunity || !detailsModal) {
    return;
  }

  modalTitle.textContent = opportunity.title;
  modalOrganizer.textContent = "Organizer: " + opportunity.organizer;
  modalCategory.textContent = opportunity.category;
  modalDescription.textContent = opportunity.description;
  modalEligibility.textContent = "Eligibility: " + opportunity.eligibility;
  modalDeadline.textContent = "Deadline: " + formatDeadline(opportunity.deadline);
  modalLocation.textContent = "Location: " + opportunity.location;
  modalApply.href = opportunity.officialUrl;

  detailsModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeDetailsModal() {
  if (!detailsModal) {
    return;
  }

  detailsModal.hidden = true;
  document.body.classList.remove("modal-open");
}

function showNoResultsMessage(searchText) {
  const message = document.createElement("p");
  message.className = "about-text";

  if (searchText !== "" && selectedCategory !== "") {
    message.textContent =
      'No ' +
      selectedCategory +
      ' opportunities match "' +
      searchText +
      '". Try another word.';
  } else if (searchText !== "") {
    message.textContent =
      'No opportunities match "' +
      searchText +
      '". Try another word, such as scholarship, internship, or the organizer name.';
  } else if (selectedCategory !== "") {
    message.textContent =
      "No " + selectedCategory + " opportunities are available right now.";
  } else {
    message.textContent = "No opportunities match your filters.";
  }

  opportunityContainer.appendChild(message);
}

function displayOpportunities(list, searchText) {
  opportunityContainer.innerHTML = "";

  if (list.length === 0) {
    showNoResultsMessage(searchText);
    return;
  }

  for (let i = 0; i < list.length; i++) {
    const card = createOpportunityCard(list[i]);
    opportunityContainer.appendChild(card);
  }
}

function matchesSearch(opportunity, searchText) {
  const text = searchText.toLowerCase();

  const title = opportunity.title.toLowerCase();
  const category = opportunity.category.toLowerCase();
  const organizer = opportunity.organizer.toLowerCase();
  const description = opportunity.description.toLowerCase();

  return (
    title.indexOf(text) !== -1 ||
    category.indexOf(text) !== -1 ||
    organizer.indexOf(text) !== -1 ||
    description.indexOf(text) !== -1
  );
}

function matchesCategory(opportunity) {
  if (selectedCategory === "") {
    return true;
  }

  return opportunity.category === selectedCategory;
}

function getVisibleOpportunities() {
  const searchText = searchInput ? searchInput.value.trim() : "";
  const matches = [];

  for (let i = 0; i < opportunities.length; i++) {
    const item = opportunities[i];
    const categoryOk = matchesCategory(item);
    const searchOk = searchText === "" || matchesSearch(item, searchText);

    if (categoryOk && searchOk) {
      matches.push(item);
    }
  }

  return matches;
}

function updateDisplay() {
  const searchText = searchInput ? searchInput.value.trim() : "";
  displayOpportunities(getVisibleOpportunities(), searchText);
}

function handleSearch() {
  updateDisplay();
}

function getCategoryFromCard(card) {
  const htmlValue = card.getAttribute("data-category");

  if (categoryNames[htmlValue]) {
    return categoryNames[htmlValue];
  }

  return htmlValue;
}

function handleCategoryClick(card) {
  selectedCategory = getCategoryFromCard(card);
  updateDisplay();
}

if (opportunityContainer && typeof opportunities !== "undefined") {
  updateDisplay();
}

if (searchInput) {
  searchInput.addEventListener("input", handleSearch);
}

if (searchForm) {
  searchForm.addEventListener("submit", function (event) {
    event.preventDefault();
    handleSearch();
  });
}

for (let i = 0; i < categoryLinks.length; i++) {
  categoryLinks[i].addEventListener("click", function () {
    const card = categoryLinks[i].parentElement;
    handleCategoryClick(card);
  });
}

if (modalClose) {
  modalClose.addEventListener("click", closeDetailsModal);
}

if (detailsModal) {
  detailsModal.addEventListener("click", function (event) {
    if (event.target === detailsModal) {
      closeDetailsModal();
    }
  });
}

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeDetailsModal();
  }
});