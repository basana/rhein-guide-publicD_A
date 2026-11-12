const LOCATION_STATES = new Set(["off", "locating", "active", "error"]);
const VIEW_MODES = new Set(["follow", "free"]);

function normalizeTextVariants(value) {
  const lower = String(value || "").toLocaleLowerCase();
  const plain = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const german = lower
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  return [...new Set([plain, german].filter(Boolean))];
}

export function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = degrees => degrees * Math.PI / 180;
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(meters) {
  if (!Number.isFinite(meters)) return "";
  return meters < 1000
    ? "≈ " + Math.round(meters / 10) * 10 + " м"
    : "≈ " + (meters / 1000).toFixed(1) + " км";
}

export function validateMapProfile(profile) {
  if (!profile || typeof profile !== "object") throw new Error("Профиль карты отсутствует");
  if (!profile.id || !profile.name) throw new Error("У профиля должны быть id и name");
  if (!Array.isArray(profile.categories) || !Array.isArray(profile.objects)) {
    throw new Error("У профиля должны быть массивы categories и objects");
  }

  const categoryIds = new Set(profile.categories.map(category => category.id));
  const objectIds = new Set();

  for (const object of profile.objects) {
    if (!object.id || !object.name) throw new Error("У каждого объекта должны быть id и name");
    if (objectIds.has(object.id)) throw new Error("Повторяющийся id объекта: " + object.id);
    objectIds.add(object.id);
    if (!categoryIds.has(object.category)) {
      throw new Error("Неизвестная категория у объекта " + object.id + ": " + object.category);
    }
    if (!Number.isFinite(object.lat) || !Number.isFinite(object.lng) ||
        object.lat < -90 || object.lat > 90 || object.lng < -180 || object.lng > 180) {
      throw new Error("Некорректные координаты объекта: " + object.id);
    }
  }
  return true;
}

export function createMapNaviCore(profile) {
  validateMapProfile(profile);

  const categories = new Set(profile.categories.map(category => category.id));
  const objects = profile.objects.map(object => ({ ...object }));
  const objectById = new Map(objects.map(object => [object.id, object]));

  let state = {
    locationState: "off",
    position: null,
    activeIntent: { type: "default" },
    viewMode: "free"
  };

  function setLocationState(nextState) {
    if (!LOCATION_STATES.has(nextState)) {
      throw new Error("Неизвестное состояние GPS: " + nextState);
    }
    state.locationState = nextState;
    if (nextState !== "active") state.position = null;
    return getSnapshot();
  }

  function setPosition(position) {
    if (!position || !Number.isFinite(position.lat) || !Number.isFinite(position.lng) ||
        position.lat < -90 || position.lat > 90 || position.lng < -180 || position.lng > 180) {
      throw new Error("Получены некорректные координаты пользователя");
    }
    state.position = { lat: position.lat, lng: position.lng };
    state.locationState = "active";
    return getSnapshot();
  }

  function setViewMode(mode) {
    if (!VIEW_MODES.has(mode)) throw new Error("Неизвестный режим камеры: " + mode);
    state.viewMode = mode;
    return getSnapshot();
  }

  function setIntent(intent) {
    if (!intent || intent.type === "default") {
      state.activeIntent = { type: "default" };
    } else if (intent.type === "category") {
      if (!categories.has(intent.category)) {
        throw new Error("Неизвестная категория: " + intent.category);
      }
      state.activeIntent = { type: "category", category: intent.category };
    } else if (intent.type === "search") {
      const query = String(intent.query || "").trim();
      state.activeIntent = query
        ? { type: "search", query }
        : { type: "default" };
    } else if (intent.type === "object") {
      if (!objectById.has(intent.objectId)) {
        throw new Error("Объект не найден: " + intent.objectId);
      }
      state.activeIntent = { type: "object", objectId: intent.objectId };
    } else {
      throw new Error("Неизвестный тип Active Map Intent");
    }
    return getSnapshot();
  }

  function getCandidates() {
    const intent = state.activeIntent;
    let matches = objects;

    if (intent.type === "category") {
      matches = objects.filter(object => object.category === intent.category);
    } else if (intent.type === "object") {
      matches = objects.filter(object => object.id === intent.objectId);
    } else if (intent.type === "search") {
      const queryVariants = normalizeTextVariants(intent.query);
      matches = objects.filter(object => {
        const fields = [object.name, object.town, ...(object.searchTerms || [])];
        const haystackVariants = fields.flatMap(normalizeTextVariants);
        return queryVariants.some(query =>
          haystackVariants.some(haystack => haystack.includes(query))
        );
      });
    }

    return matches
      .map(object => ({
        ...object,
        distanceMeters: state.position
          ? haversineMeters(state.position.lat, state.position.lng, object.lat, object.lng)
          : null
      }))
      .sort((a, b) => {
        if (a.distanceMeters === null || b.distanceMeters === null) return 0;
        return a.distanceMeters - b.distanceMeters;
      });
  }

  function getSnapshot() {
    const candidates = getCandidates();
    return {
      profileId: profile.id,
      locationState: state.locationState,
      position: state.position ? { ...state.position } : null,
      activeIntent: { ...state.activeIntent },
      viewMode: state.viewMode,
      candidates,
      primaryObject: candidates[0] || null
    };
  }

  return Object.freeze({
    setLocationState,
    setPosition,
    setViewMode,
    setIntent,
    getSnapshot
  });
}


/**
 * Decide how GPS updates may control the map camera.
 * "fit-intent" is used once after the first valid fix;
 * later updates may pan only in the default Follow context.
 */
export function getCameraAction(snapshot, hasReceivedGpsFix) {
  if (!snapshot || snapshot.viewMode !== "follow" || !snapshot.position) {
    return "hold";
  }
  if (!hasReceivedGpsFix) return "fit-intent";
  return snapshot.activeIntent?.type === "default" ? "pan-user" : "hold";
}
