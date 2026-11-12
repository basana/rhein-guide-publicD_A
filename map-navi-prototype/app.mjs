import { createMapNaviCore, formatDistance, getCameraAction } from "./core.mjs";

const $ = id => document.getElementById(id);
const statusEl = $("status");
const searchEl = $("search");
const resultsEl = $("results");
const cardEl = $("objectCard");
const markerLayer = L.layerGroup();
let profile;
let core;
let map;
let gpsWatchId = null;
let gpsActive = false;
let hasReceivedGpsFix = false;
let userMarker = null;
let programmaticMove = false;
let moveResetTimer = null;

function setProgrammaticMove(action) {
  programmaticMove = true;
  if (moveResetTimer) clearTimeout(moveResetTimer);
  map.once("moveend", () => {
    programmaticMove = false;
    if (moveResetTimer) clearTimeout(moveResetTimer);
  });
  action();
  moveResetTimer = setTimeout(() => { programmaticMove = false; }, 500);
}

function categoryInfo(id) {
  return profile.categories.find(category => category.id === id) || {
    label: id, color: "#64748b"
  };
}

function setIntent(intent, shouldFit = false) {
  core.setIntent(intent);
  render();
  if (shouldFit) fitCurrentIntent();
}

function fitCurrentIntent() {
  const snapshot = core.getSnapshot();
  const candidates = snapshot.position
    ? snapshot.candidates.slice(0, 3)
    : snapshot.candidates;
  const points = [];

  if (snapshot.position) points.push([snapshot.position.lat, snapshot.position.lng]);
  candidates.forEach(item => points.push([item.lat, item.lng]));

  if (!points.length) return;
  setProgrammaticMove(() => {
    if (points.length === 1) {
      map.setView(points[0], 14, { animate: false });
    } else {
      map.fitBounds(L.latLngBounds(points).pad(0.28), { maxZoom: 15, animate: false });
    }
  });
}

function fitFullProfile() {
  core.setViewMode("free");
  setProgrammaticMove(() => map.fitBounds(profile.map.bounds, { padding: [18, 18], animate: false }));
  render();
}

function renderMarkers(snapshot) {
  markerLayer.clearLayers();
  snapshot.candidates.forEach(item => {
    const category = categoryInfo(item.category);
    const selected = snapshot.activeIntent.type === "object" &&
      snapshot.activeIntent.objectId === item.id;
    const offset = item.markerOffset || [0, 0];
    const marker = L.circleMarker([item.lat + offset[0], item.lng + offset[1]], {
      radius: selected ? 10 : 7,
      color: "#fff",
      weight: selected ? 3 : 2,
      fillColor: category.color,
      fillOpacity: 0.95
    }).addTo(markerLayer);
    marker.bindTooltip(item.name, { direction: "top", offset: [0, -6] });
    marker.on("click", () => {
      setIntent({ type: "object", objectId: item.id });
      if (gpsActive && core.getSnapshot().viewMode === "follow") fitCurrentIntent();
      else setProgrammaticMove(() => map.setView([item.lat, item.lng], Math.max(map.getZoom(), 13), { animate: false }));
    });
  });
}

function renderResults(snapshot) {
  resultsEl.replaceChildren();
  if (!snapshot.candidates.length) {
    const empty = document.createElement("span");
    empty.className = "empty";
    empty.textContent = "Совпадений нет. Попробуйте другое название или категорию.";
    resultsEl.append(empty);
    return;
  }

  snapshot.candidates.slice(0, 8).forEach(item => {
    const button = document.createElement("button");
    button.className = "result-chip";
    button.type = "button";
    button.textContent = item.name;
    button.addEventListener("click", () => {
      searchEl.value = "";
      setIntent({ type: "object", objectId: item.id });
      if (gpsActive && core.getSnapshot().viewMode === "follow") fitCurrentIntent();
      else setProgrammaticMove(() => map.setView([item.lat, item.lng], Math.max(map.getZoom(), 13), { animate: false }));
    });
    resultsEl.append(button);
  });
}

function renderCard(snapshot) {
  const item = snapshot.primaryObject;
  if (!item) {
    cardEl.classList.add("empty-card");
    $("objectTitle").textContent = "Нет подходящих объектов";
    $("objectMeta").textContent = "Активная категория или запрос не будут подменены другими объектами.";
    $("objectDistance").textContent = "";
    $("sayEn").textContent = "";
    $("sayRu").textContent = "";
    $("objectImage").hidden = true;
    return;
  }

  cardEl.classList.remove("empty-card");
  $("objectTitle").textContent = item.name;
  $("objectMeta").textContent = item.town + " · " + categoryInfo(item.category).label;
  $("objectDistance").textContent = item.distanceMeters === null
    ? "Включите GPS, чтобы увидеть расстояние по прямой."
    : formatDistance(item.distanceMeters) + " по прямой";
  $("sayEn").textContent = item.say || "Текст пока не добавлен.";
  $("sayRu").textContent = item.sayRu || "Текст пока не добавлен.";

  const image = $("objectImage");
  if (item.image) {
    image.hidden = false;
    image.src = item.image;
    image.alt = item.name;
    let triedJpegAlternative = false;
    image.onerror = () => {
      if (!triedJpegAlternative && /\.jpg(?:\?.*)?$/i.test(image.src)) {
        triedJpegAlternative = true;
        image.src = image.src.replace(/\.jpg(?:\?.*)?$/i, ".jpeg");
        return;
      }
      image.hidden = true;
    };
  } else {
    image.hidden = true;
  }
}

function renderStatus(snapshot) {
  let locationText = "GPS выключен";
  if (snapshot.locationState === "locating") locationText = "Определяем положение…";
  if (snapshot.locationState === "active") locationText = "GPS активен";
  if (snapshot.locationState === "error") locationText = "Нет сигнала GPS";

  const viewText = snapshot.viewMode === "follow" ? "Follow" : "Free View";
  statusEl.textContent = locationText + " · " + viewText;
  $("gpsButton").textContent = gpsActive ? "Выключить GPS" : "Включить GPS";
  $("followButton").disabled = !gpsActive;
  $("followButton").textContent = snapshot.viewMode === "follow" ? "Follow ✓" : "Вернуться к Follow";
  document.querySelectorAll("[data-category]").forEach(button => {
    const active = snapshot.activeIntent.type === "default"
      ? button.dataset.category === "all"
      : snapshot.activeIntent.type === "category" &&
        button.dataset.category === snapshot.activeIntent.category;
    button.classList.toggle("active", active);
  });
}

function render() {
  const snapshot = core.getSnapshot();
  renderStatus(snapshot);
  renderMarkers(snapshot);
  renderResults(snapshot);
  renderCard(snapshot);
  $("objectCount").textContent = "Объектов: " + snapshot.candidates.length;
  if (userMarker && snapshot.position) {
    userMarker.setLatLng([snapshot.position.lat, snapshot.position.lng]);
  }
}

function startGps() {
  if (!navigator.geolocation) {
    core.setLocationState("error");
    render();
    statusEl.textContent = "Браузер не поддерживает геолокацию.";
    return;
  }
  if (gpsActive) return;

  gpsActive = true;
  hasReceivedGpsFix = false;
  core.setLocationState("locating");
  core.setViewMode("follow");
  render();

  gpsWatchId = navigator.geolocation.watchPosition(position => {
    const point = {
      lat: position.coords.latitude,
      lng: position.coords.longitude
    };
    core.setPosition(point);

    if (!userMarker) {
      const userIcon = L.divIcon({
        className: "",
        html: '<div class="user-dot"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });
      userMarker = L.marker([point.lat, point.lng], {
        icon: userIcon, zIndexOffset: 1000
      }).addTo(map);
    } else {
      userMarker.setLatLng([point.lat, point.lng]);
    }

    render();

    const snapshot = core.getSnapshot();
    const cameraAction = getCameraAction(snapshot, hasReceivedGpsFix);
    if (cameraAction === "fit-intent") {
      hasReceivedGpsFix = true;
      fitCurrentIntent();
    } else if (cameraAction === "pan-user") {
      // В обычном режиме Follow GPS перемещает карту, но не пересчитывает zoom.
      setProgrammaticMove(() => map.panTo([point.lat, point.lng], { animate: false }));
    }
    // При активной категории/поиске/объекте камера не перехватывается GPS.
    // В Free View GPS обновляет координаты и маркер, но не двигает карту.
  }, error => {
    gpsActive = false;
    if (gpsWatchId !== null) navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
    hasReceivedGpsFix = false;
    core.setLocationState("error");
    render();
    const messages = {
      1: "Нет разрешения на геолокацию.",
      2: "Местоположение временно недоступно.",
      3: "Истекло время ожидания GPS."
    };
    statusEl.textContent = (messages[error.code] || "Ошибка GPS") + " · Free View";
    if (userMarker) {
      map.removeLayer(userMarker);
      userMarker = null;
    }
  }, {
    enableHighAccuracy: true,
    maximumAge: 10000,
    timeout: 15000
  });
}

function stopGps() {
  if (gpsWatchId !== null) navigator.geolocation.clearWatch(gpsWatchId);
  gpsWatchId = null;
  gpsActive = false;
  hasReceivedGpsFix = false;
  core.setLocationState("off");
  core.setViewMode("free");
  if (userMarker) {
    map.removeLayer(userMarker);
    userMarker = null;
  }
  render();
}

async function init() {
  const response = await fetch("./profiles/rhine.json");
  if (!response.ok) throw new Error("Не удалось загрузить профиль Среднего Рейна.");
  profile = await response.json();
  core = createMapNaviCore(profile);

  map = L.map("map", { zoomControl: false, scrollWheelZoom: true })
    .setView(profile.map.center, profile.map.zoom);

  // Leaflet must recalculate its viewport after iPhone/iPad rotation or resizing.
  const refreshMapSize = () => requestAnimationFrame(() => map.invalidateSize({ pan: false }));
  window.addEventListener("resize", refreshMapSize, { passive: true });
  window.addEventListener("orientationchange", refreshMapSize, { passive: true });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
  L.control.zoom({ position: "bottomright" }).addTo(map);
  markerLayer.addTo(map);
  setProgrammaticMove(() => map.fitBounds(profile.map.bounds, { padding: [18, 18], animate: false }));

  map.on("dragstart", () => {
    if (gpsActive && !programmaticMove) {
      core.setViewMode("free");
      renderStatus(core.getSnapshot());
    }
  });
  map.on("zoomstart", () => {
    if (gpsActive && !programmaticMove) {
      core.setViewMode("free");
      renderStatus(core.getSnapshot());
    }
  });

  document.querySelectorAll("[data-category]").forEach(button => {
    button.addEventListener("click", () => {
      searchEl.value = "";
      const category = button.dataset.category;
      setIntent(category === "all"
        ? { type: "default" }
        : { type: "category", category }, true);
    });
  });

  searchEl.addEventListener("input", () => {
    const query = searchEl.value.trim();
    core.setIntent(query ? { type: "search", query } : { type: "default" });
    render();
  });
  searchEl.addEventListener("keydown", event => {
    if (event.key === "Enter") fitCurrentIntent();
  });

  $("gpsButton").addEventListener("click", () => gpsActive ? stopGps() : startGps());
  $("followButton").addEventListener("click", () => {
    if (!gpsActive) return;
    core.setViewMode("follow");
    fitCurrentIntent();
    renderStatus(core.getSnapshot());
  });
  $("fullMapButton").addEventListener("click", fitFullProfile);
  $("mapResetButton").addEventListener("click", fitFullProfile);

  render();
}

init().catch(error => {
  statusEl.textContent = "Ошибка запуска прототипа";
  cardEl.classList.add("empty-card");
  $("objectTitle").textContent = error.message;
  $("objectMeta").textContent = "Проверьте, что страница запущена через HTTP/HTTPS, а не как локальный file://.";
});
