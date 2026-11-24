const filters = document.querySelector("#publication-filters");
const search = document.querySelector("#publication-search");
const author = document.querySelector("#publication-author");
const results = document.querySelector("#publication-results");

const normalise = (text) => text.toLowerCase()
  .replace(/xin\s*wei(?:\s+lee)?|lee\s+xin\s*wei/g, "lee xin wei")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const groups = [...document.querySelectorAll("[data-publication-year]")].map((section) => ({
  section,
  papers: [...section.querySelectorAll("[data-authors]")].map((item) => ({
    item,
    authors: item.dataset.authors.split(" "),
    searchable: normalise(`${section.dataset.publicationYear} ${item.innerText}`),
  })),
}));

function applyFilters() {
  const query = normalise(search.value);
  const terms = query ? query.split(" ") : [];
  let count = 0;

  for (const { section, papers } of groups) {
    let yearCount = 0;
    for (const { item, authors, searchable } of papers) {
      const matchesAuthor = !author.value || authors.includes(author.value);
      const matchesSearch = terms.every((term) => searchable.includes(term));
      item.hidden = !(matchesAuthor && matchesSearch);
      yearCount += Number(!item.hidden);
    }
    section.hidden = yearCount === 0;
    count += yearCount;
  }

  results.textContent = count === 0 ? "No matching publications"
    : count === 1 ? "1 publication" : `${count} publications`;
}

const selectedAuthor = new URLSearchParams(window.location.search).get("author");
if ([...author.options].some((option) => option.value === selectedAuthor)) {
  author.value = selectedAuthor;
}

search.addEventListener("input", applyFilters);
author.addEventListener("change", applyFilters);
window.addEventListener("pageshow", applyFilters);
applyFilters();
filters.hidden = false;
