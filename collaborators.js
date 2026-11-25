const publicationsUrl = new URL("publications.html", window.location.href);
const world = { width: 800, height: 510 };

// Keep the established network in the same places as the year and author change.
const authorPositions = new Map([
  ["Monit Sharma", [157, 220]], ["Hoong Chuin Lau", [345, 320]], ["Lee Xin Wei", [538, 199]],
  ["Rudy Raymond", [92, 111]], ["Yan Jin", [105, 326]], ["Siong Thye Goh", [259, 419]],
  ["Masayuki Ohzeki", [338, 69]], ["Sasuke Kimata", [303, 167]], ["Jonathan Teo", [488, 84]],
  ["Xinjian Yan", [644, 114]], ["Leo Kurosawa", [731, 181]], ["Tiejin Chen", [738, 285]],
  ["Dongsheng Cai", [641, 259]], ["Ningyi Xie", [531, 310]], ["Jiahua Xu", [638, 365]],
  ["Jungpil Shin", [739, 403]], ["Nobuyoshi Asai", [534, 430]], ["Yoshiyuki Saito", [403, 403]],
]);

function readPublications(page) {
  const members = new Set([...page.querySelectorAll("#publication-author option[value]")]
    .filter((option) => option.value)
    .map((option) => option.textContent.trim()));
  const names = new Map([...members].map((name) => [name.toLowerCase(), name]));
  const lee = names.get("lee xin wei");
  if (lee) {
    names.set("xin wei lee", lee);
    names.set("xinwei lee", lee);
  }

  const papers = [];
  for (const item of page.querySelectorAll("[data-publication-year] [data-authors]")) {
    const byline = item.querySelector(".authors");
    const title = item.querySelector("h3 a[href]");
    if (!byline || !title) continue;

    const authors = [...new Set(byline.textContent.split(/\s*(?:,|\band\b)\s*/i)
      .map((name) => name.trim().replace(/\s+/g, " "))
      .filter(Boolean)
      .map((name) => {
        const key = name.toLowerCase();
        if (!names.has(key)) names.set(key, name);
        return names.get(key);
      }))];
    if (authors.length < 2 || !authors.some((name) => members.has(name))) continue;

    papers.push({
      authors,
      title: title.textContent.trim(),
      year: item.closest("[data-publication-year]").dataset.publicationYear,
      url: item.id ? new URL(`#${encodeURIComponent(item.id)}`, publicationsUrl) : new URL(title.getAttribute("href"), publicationsUrl),
    });
  }
  return { members, papers };
}

function indexNetwork(papers) {
  const byAuthor = new Map();
  const neighbours = new Map();
  for (const paper of papers) {
    for (const name of paper.authors) {
      if (!byAuthor.has(name)) {
        byAuthor.set(name, []);
        neighbours.set(name, new Map());
      }
      byAuthor.get(name).push(paper);

      const links = neighbours.get(name);
      for (const coauthor of paper.authors) {
        if (coauthor !== name) links.set(coauthor, (links.get(coauthor) || 0) + 1);
      }
    }
  }
  return { byAuthor, neighbours };
}

function layoutAuthors(authors) {
  const positions = new Map();
  for (const name of authors) {
    if (authorPositions.has(name)) positions.set(name, authorPositions.get(name));
  }

  // Fit new bylines into open space without shifting the rest of the map.
  for (const name of authors) {
    if (positions.has(name)) continue;

    let bestPoint;
    let bestSpacing = -1;
    const placed = [...positions.values()];
    for (let x = 75; x <= 735; x += 30) {
      for (let y = 68; y <= 430; y += 30) {
        const spacing = Math.min(...placed.map(([px, py]) => Math.hypot(x - px, (y - py) * 1.6)));
        if (spacing > bestSpacing) {
          bestPoint = [x, y];
          bestSpacing = spacing;
        }
      }
    }
    positions.set(name, bestPoint);
  }
  return positions;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function initials(name) {
  return name.split(" ").map((part) => part[0]).slice(0, 3).join("");
}

function countLabel(count, singular) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function renderNetwork({ members, papers }) {
  const explorer = document.querySelector("#collaboration-network");
  const plot = document.querySelector("#collaboration-plot");
  const details = document.querySelector("#collaboration-details");
  const detailLink = document.querySelector("#network-detail-link");
  const announcement = document.querySelector("#network-announcement");
  const yearSelect = document.querySelector("#network-year");
  const query = document.querySelector("#network-query");
  const results = document.querySelector("#network-results");
  const zoomIn = document.querySelector("#network-zoom-in");
  const zoomOut = document.querySelector("#network-zoom-out");
  const fit = document.querySelector("#network-fit");
  const resetLayout = document.querySelector("#network-layout-reset");
  const mapHint = document.querySelector("#network-map-hint");
  const canvas = plot.querySelector("canvas");
  const context = canvas.getContext("2d");
  const years = [...new Set(papers.map(({ year }) => year))].sort().reverse();
  const fullNetwork = indexNetwork(papers);
  const authors = [...fullNetwork.byAuthor.keys()].sort((first, second) => first.localeCompare(second, "en-SG"));
  const initialPositions = layoutAuthors(authors);
  const movedPositions = new Map();
  let positions = new Map(initialPositions);
  const nodes = new Map();
  const clearances = new Map();
  const camera = { x: 0, y: 0, zoom: 1 };
  const viewport = { width: 0, height: 0, scaleX: 1, scaleY: 1 };
  let active = fullNetwork;
  let selected = "";
  let hovered = "";
  let drag;
  let suppressClick = false;

  for (const year of years) yearSelect.add(new Option(year, year));

  for (const name of authors) {
    const button = element("button", "network-node");
    button.type = "button";
    button.setAttribute("aria-label", name);
    button.toggleAttribute("data-member", members.has(name));
    const orb = element("span", "network-orb", members.has(name) ? initials(name) : "");
    orb.setAttribute("aria-hidden", "true");
    button.append(orb, element("span", "network-node-label", name));
    button.addEventListener("click", () => selectAuthor(selected === name ? "" : name));
    button.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "touch" || drag?.moved) return;
      hovered = name;
      paintFocus();
    });
    button.addEventListener("pointerleave", () => {
      if (hovered !== name) return;
      hovered = "";
      paintFocus();
    });
    button.addEventListener("focus", () => {
      if (button.matches(":focus-visible")) keepAuthorInView(name);
    });
    plot.insertBefore(button, zoomIn.parentElement);
    nodes.set(name, button);
  }

  function project(name) {
    const [x, y] = positions.get(name);
    return [viewport.width / 2 + camera.x + (x - world.width / 2) * viewport.scaleX * camera.zoom,
      viewport.height / 2 - 10 + camera.y + (y - world.height / 2) * viewport.scaleY * camera.zoom];
  }

  function constrainPosition(x, y) {
    return [Math.max(65, Math.min(world.width - 65, x)), Math.max(43, Math.min(world.height - 65, y))];
  }

  function measureNodes() {
    const compact = window.matchMedia("(width <= 38rem)").matches;
    for (const [name, button] of nodes) {
      if (button.hidden) continue;

      const [orb, label] = button.children;
      const radius = orb.offsetWidth / 2 + 3;
      const showLabel = !compact || members.has(name);
      clearances.set(name, {
        halfWidth: showLabel ? Math.max(radius, label.offsetWidth / 2 + 3) : radius,
        top: radius,
        bottom: showLabel ? radius + label.offsetHeight + 4 : radius,
      });
    }
  }

  function adjustLayout() {
    positions = new Map(initialPositions);
    for (const [name, point] of movedPositions) positions.set(name, point);
    if (!movedPositions.size) return;

    // Give the most recently moved author priority and make room around moved nodes.
    const priority = [...movedPositions.keys()].reverse();
    const displaced = [];
    for (const name of [...priority, ...authors.filter((author) => !movedPositions.has(author))]) {
      if (!active.byAuthor.has(name)) continue;

      let [x, y] = positions.get(name);
      let affected = movedPositions.has(name);
      const own = clearances.get(name);
      for (const other of displaced) {
        const [otherX, otherY] = positions.get(other);
        const obstacle = clearances.get(other);
        const dx = (x - otherX) * viewport.scaleX;
        const dy = (y - otherY) * viewport.scaleY;
        const distance = Math.hypot(dx, dy);
        const [restX, restY] = initialPositions.get(name);
        const angle = distance ? Math.atan2(dy, dx)
          : Math.atan2((restY - otherY) * viewport.scaleY, (restX - otherX) * viewport.scaleX);
        const directionX = Math.cos(angle);
        const directionY = Math.sin(angle);
        const gapX = own.halfWidth + obstacle.halfWidth;
        const gapY = directionY < 0 ? own.bottom + obstacle.top : own.top + obstacle.bottom;
        const clearance = 1 / Math.hypot(directionX / gapX, directionY / gapY);
        if (distance >= clearance) continue;

        [x, y] = constrainPosition(otherX + directionX * clearance / viewport.scaleX,
          otherY + directionY * clearance / viewport.scaleY);
        affected = true;
      }
      if (affected) {
        positions.set(name, [x, y]);
        displaced.push(name);
      }
    }
  }

  function moveAuthor(name, x, y) {
    movedPositions.delete(name);
    movedPositions.set(name, constrainPosition(x, y));
    mapHint.hidden = true;
    resetLayout.hidden = false;
    adjustLayout();
    paintCamera();
  }

  function focusedAuthor() {
    return (drag?.moved && drag.name) || selected || hovered;
  }

  function drawConnections(focused) {
    if (!context || !viewport.width) return;

    const ratio = window.devicePixelRatio || 1;
    const pixelWidth = Math.round(viewport.width * ratio);
    const pixelHeight = Math.round(viewport.height * ratio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, viewport.width, viewport.height);

    function drawLine(first, second, count, colour) {
      const [x1, y1] = project(first);
      const [x2, y2] = project(second);
      const bow = Math.min(20, Math.hypot(x2 - x1, y2 - y1) * 0.065);
      context.beginPath();
      context.moveTo(x1, y1);
      context.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 - bow, x2, y2);
      context.strokeStyle = colour;
      context.lineWidth = 1 + 0.44 * Math.log2(count);
      context.stroke();
    }

    for (const first of members) {
      for (const [second, count] of active.neighbours.get(first) || []) {
        if (members.has(second) && first > second) continue;
        if (first === focused || second === focused) continue;
        drawLine(first, second, count, focused ? "#8492b33f" : "#697fa68a");
      }
    }
    for (const [other, count] of active.neighbours.get(focused) || []) {
      drawLine(focused, other, count, "#9d753bcc");
    }
  }

  function paintFocus() {
    const focused = focusedAuthor();
    const neighbours = active.neighbours.get(focused);
    for (const [name, button] of nodes) {
      button.setAttribute("aria-pressed", String(name === selected));
      button.toggleAttribute("data-related", Boolean(neighbours?.has(name)));
      button.toggleAttribute("data-dimmed", Boolean(neighbours) && name !== focused && !neighbours.has(name));
    }
    drawConnections(focused);
  }

  function paintCamera() {
    const maxX = viewport.width * camera.zoom / 2;
    const maxY = viewport.height * camera.zoom / 2;
    camera.x = Math.max(-maxX, Math.min(maxX, camera.x));
    camera.y = Math.max(-maxY, Math.min(maxY, camera.y));
    for (const [name, button] of nodes) {
      const [x, y] = project(name);
      button.style.left = `${x}px`;
      button.style.top = `${y}px`;
    }
    plot.toggleAttribute("data-zoomed", camera.zoom > 1);
    plot.toggleAttribute("data-expanded", camera.zoom >= 1.6);
    zoomOut.setAttribute("aria-disabled", String(camera.zoom <= 1));
    zoomIn.setAttribute("aria-disabled", String(camera.zoom >= 3));
    drawConnections(focusedAuthor());
  }

  function sizeMap() {
    viewport.width = plot.clientWidth;
    viewport.height = plot.clientHeight;
    viewport.scaleX = Math.max(1, viewport.width - 28) / world.width;
    viewport.scaleY = Math.max(1, viewport.height - 45) / world.height;
    measureNodes();
    adjustLayout();
    paintCamera();
  }

  function keepAuthorInView(name) {
    const [x, y] = project(name);
    if (x < 40 || x > viewport.width - 40 || y < 36 || y > viewport.height - 64) {
      camera.x += viewport.width / 2 - x;
      camera.y += viewport.height / 2 - 10 - y;
      paintCamera();
    }
  }

  function changeZoom(multiplier, x = viewport.width / 2, y = viewport.height / 2 - 10) {
    const next = Math.max(1, Math.min(3, camera.zoom * multiplier));
    if (next === camera.zoom) return;

    const anchorX = x - viewport.width / 2;
    const anchorY = y - viewport.height / 2 + 10;
    const change = next / camera.zoom;
    camera.x = anchorX + (camera.x - anchorX) * change;
    camera.y = anchorY + (camera.y - anchorY) * change;
    camera.zoom = next;
    paintCamera();
  }

  function fitMap() {
    Object.assign(camera, { x: 0, y: 0, zoom: 1 });
    paintCamera();
  }

  function makeAuthorRow(name, meta) {
    const item = element("li");
    const button = element("button", "network-author-link");
    button.type = "button";
    const badge = element("span", "network-initials", initials(name));
    badge.toggleAttribute("data-member", members.has(name));
    badge.setAttribute("aria-hidden", "true");
    const label = element("span");
    label.append(element("strong", "", name));
    if (meta) label.append(element("small", "", meta));
    button.append(badge, label);
    button.addEventListener("click", () => {
      selectAuthor(name);
      details.focus({ preventScroll: true });
    });
    item.append(button);
    return item;
  }

  function renderDetails() {
    const header = element("div", "network-detail-header");
    const body = element("div", "network-detail-body");
    const works = active.byAuthor.get(selected);

    header.append(element("h3", "", selected || "Network overview"));
    if (!works) {
      header.append(element("p", "", "Select a name to follow their collaborations."));
      const list = element("ul", "network-detail-list");
      for (const name of members) {
        if (active.byAuthor.has(name)) list.append(makeAuthorRow(name));
      }
      body.append(element("h4", "", "SMU Quantum"), list);
      details.replaceChildren(header, body);
      return;
    }

    const colleagues = active.neighbours.get(selected);
    const metrics = element("dl", "network-metrics");
    for (const [label, value] of [["Publications", works.length], ["Co-authors", colleagues.size]]) {
      const metric = element("div");
      metric.append(element("dt", "", label), element("dd", "", value));
      metrics.append(metric);
    }

    header.append(element("p", "", members.has(selected) ? "SMU Quantum" : "Co-author"));
    const clear = element("button", "network-clear", "×");
    clear.type = "button";
    clear.setAttribute("aria-label", "Clear author selection");
    clear.addEventListener("click", () => {
      selectAuthor("");
      details.focus({ preventScroll: true });
    });
    header.append(clear);

    const tabs = element("div", "network-detail-tabs");
    tabs.setAttribute("role", "group");
    tabs.setAttribute("aria-label", "Author details");
    const publicationsTab = element("button", "", "Publications");
    const coauthorsTab = element("button", "", "Co-authors");
    publicationsTab.type = coauthorsTab.type = "button";
    tabs.append(publicationsTab, coauthorsTab);

    function showTab(showPublications) {
      const list = element("ul", "network-detail-list");
      if (showPublications) {
        for (const { title, year, url } of works) {
          const item = element("li");
          const link = element("a", "network-paper-link");
          link.href = url;
          link.append(element("span", "network-paper-year", year), element("strong", "", title));
          item.append(link);
          list.append(item);
        }
      } else {
        const ranked = [...colleagues].sort(([first, firstCount], [second, secondCount]) =>
          secondCount - firstCount || first.localeCompare(second, "en-SG"));
        for (const [name, count] of ranked) list.append(makeAuthorRow(name, countLabel(count, "shared paper")));
      }
      publicationsTab.setAttribute("aria-pressed", String(showPublications));
      coauthorsTab.setAttribute("aria-pressed", String(!showPublications));
      body.replaceChildren(list);
      body.scrollTop = 0;
    }

    publicationsTab.addEventListener("click", () => showTab(true));
    coauthorsTab.addEventListener("click", () => showTab(false));
    showTab(true);
    details.replaceChildren(header, metrics, tabs, body);
  }

  function selectAuthor(name) {
    selected = name;
    hovered = "";
    query.value = name;
    results.hidden = true;
    detailLink.hidden = !name;
    if (name) keepAuthorInView(name);
    paintFocus();
    renderDetails();
    announcement.textContent = name ? `${name}, ${countLabel(active.byAuthor.get(name).length, "publication")}`
      : "Network overview";
  }

  function changeYear() {
    active = yearSelect.value ? indexNetwork(papers.filter(({ year }) => year === yearSelect.value)) : fullNetwork;
    for (const [name, button] of nodes) {
      const works = active.byAuthor.get(name);
      button.hidden = !works;
      if (works) button.style.setProperty("--orb-size", `${11 + 3.6 * Math.sqrt(works.length)}px`);
    }
    measureNodes();
    adjustLayout();
    paintCamera();
    selectAuthor(active.byAuthor.has(selected) ? selected : "");
  }

  function searchAuthors() {
    const terms = query.value.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    results.replaceChildren();
    results.hidden = !terms.length;
    if (!terms.length) return;

    const matches = authors.filter((name) => active.byAuthor.has(name) && terms.every((term) => name.toLocaleLowerCase().includes(term)));
    if (!matches.length) results.append(element("p", "", "No matching authors for this year filter."));
    for (const name of matches) {
      const button = element("button", "", name);
      button.type = "button";
      button.append(element("span", "", countLabel(active.byAuthor.get(name).length, "paper")));
      button.addEventListener("click", () => {
        query.focus({ preventScroll: true });
        selectAuthor(name);
      });
      results.append(button);
    }
  }

  query.addEventListener("input", searchAuthors);
  query.addEventListener("focus", searchAuthors);
  query.addEventListener("keydown", (event) => {
    if (results.hidden) return;
    const first = results.querySelector("button");
    if (event.key === "Enter" && first) {
      event.preventDefault();
      first.click();
    }
    if (event.key === "ArrowDown" && first) {
      event.preventDefault();
      first.focus();
    }
  });
  const search = query.closest(".network-search");
  search.addEventListener("focusout", (event) => {
    if (!search.contains(event.relatedTarget)) results.hidden = true;
  });
  search.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || results.hidden) return;
    event.preventDefault();
    query.focus();
    results.hidden = true;
  });
  yearSelect.addEventListener("change", changeYear);

  zoomIn.addEventListener("click", () => changeZoom(1.28));
  zoomOut.addEventListener("click", () => changeZoom(1 / 1.28));
  fit.addEventListener("click", fitMap);
  resetLayout.addEventListener("click", () => {
    movedPositions.clear();
    adjustLayout();
    fitMap();
    fit.focus({ preventScroll: true });
    resetLayout.hidden = true;
    mapHint.hidden = false;
    announcement.textContent = "Original layout restored.";
  });
  plot.addEventListener("keydown", (event) => {
    const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const move = moves[event.key];
    if (event.target !== plot) {
      const author = event.target.closest(".network-node");
      if (!author || !move || !event.shiftKey || drag?.moved) return;

      event.preventDefault();
      const name = author.getAttribute("aria-label");
      const [x, y] = positions.get(name);
      moveAuthor(name, x + move[0] * 18 / (viewport.scaleX * camera.zoom), y + move[1] * 18 / (viewport.scaleY * camera.zoom));
      keepAuthorInView(name);
      announcement.textContent = `${name} moved.`;
      return;
    }

    if (move) {
      event.preventDefault();
      camera.x -= move[0] * 36;
      camera.y -= move[1] * 36;
      paintCamera();
    } else if (event.key === "Home") {
      event.preventDefault();
      fitMap();
    }
  });
  plot.addEventListener("dblclick", (event) => {
    if (!event.target.closest("button")) changeZoom(1.35, event.offsetX, event.offsetY);
  });
  plot.addEventListener("wheel", (event) => {
    if ((!event.ctrlKey && !event.metaKey) || event.target.closest(".network-controls")) return;
    event.preventDefault();
    const bounds = plot.getBoundingClientRect();
    changeZoom(event.deltaY < 0 ? 1.12 : 1 / 1.12, event.clientX - bounds.left, event.clientY - bounds.top);
  }, { passive: false });

  plot.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || drag || event.target.closest(".network-controls")) return;
    suppressClick = false;
    const name = event.target.closest(".network-node")?.getAttribute("aria-label");
    const [x, y] = name ? positions.get(name) : [camera.x, camera.y];
    drag = { id: event.pointerId, name, startX: event.clientX, startY: event.clientY, x, y, moved: false };
  });
  plot.addEventListener("pointermove", (event) => {
    if (drag?.id !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    if (!drag.moved) {
      drag.moved = true;
      plot.setPointerCapture(event.pointerId);
      plot.setAttribute("data-dragging", "");
      nodes.get(drag.name)?.setAttribute("data-moving", "");
      hovered = "";
      paintFocus();
    }
    if (drag.name) {
      moveAuthor(drag.name, drag.x + dx / (viewport.scaleX * camera.zoom), drag.y + dy / (viewport.scaleY * camera.zoom));
    } else {
      camera.x = drag.x + dx;
      camera.y = drag.y + dy;
      paintCamera();
    }
  });
  function finishDrag(event) {
    if (drag?.id !== event.pointerId) return;
    suppressClick = drag.moved && event.type === "pointerup";
    const movedAuthor = drag.moved && drag.name;
    drag = undefined;
    plot.removeAttribute("data-dragging");
    if (movedAuthor) {
      nodes.get(movedAuthor).removeAttribute("data-moving");
      announcement.textContent = `${movedAuthor} moved.`;
    }
    paintFocus();
  }
  window.addEventListener("pointerup", finishDrag);
  window.addEventListener("pointercancel", finishDrag);
  plot.addEventListener("lostpointercapture", finishDrag);
  plot.addEventListener("click", (event) => {
    if (!suppressClick || !event.detail) return;
    suppressClick = false;
    event.stopPropagation();
    event.preventDefault();
  }, true);

  explorer.hidden = false;
  document.querySelector("#collaboration-fallback").hidden = true;
  sizeMap();
  changeYear();
  new ResizeObserver(sizeMap).observe(plot);
}

async function loadNetwork() {
  try {
    const response = await fetch(publicationsUrl);
    if (!response.ok) return;

    const page = new DOMParser().parseFromString(await response.text(), "text/html");
    const data = readPublications(page);
    if (data.papers.length) renderNetwork(data);
  } catch (error) {
    console.warn("Could not load the collaboration network.", error);
  }
}

loadNetwork();
