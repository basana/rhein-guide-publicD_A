import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMapNaviCore, getCameraAction, haversineMeters, validateMapProfile } from "../core.mjs";

const profile = JSON.parse(
  readFileSync(new URL("../profiles/rhine.json", import.meta.url), "utf8")
);

test("профиль содержит уникальные объекты с допустимыми категориями и координатами", () => {
  assert.equal(validateMapProfile(profile), true);
  assert.equal(profile.objects.length, 22);
});

test("GPS → категория и категория → GPS дают одинаковый список", () => {
  const first = createMapNaviCore(profile);
  first.setPosition({ lat: 50.36, lng: 7.5978 });
  first.setIntent({ type: "category", category: "town" });

  const second = createMapNaviCore(profile);
  second.setIntent({ type: "category", category: "town" });
  second.setPosition({ lat: 50.36, lng: 7.5978 });

  assert.deepEqual(
    first.getSnapshot().candidates.map(item => item.id),
    second.getSnapshot().candidates.map(item => item.id)
  );
});

test("Free View не очищает активную категорию и не останавливает обновление позиции", () => {
  const core = createMapNaviCore(profile);
  core.setIntent({ type: "category", category: "castle" });
  core.setPosition({ lat: 50.36, lng: 7.5978 });
  core.setViewMode("free");
  core.setPosition({ lat: 50.35, lng: 7.61 });

  const snapshot = core.getSnapshot();
  assert.deepEqual(snapshot.activeIntent, { type: "category", category: "castle" });
  assert.equal(snapshot.viewMode, "free");
  assert.equal(snapshot.locationState, "active");
  assert.deepEqual(snapshot.position, { lat: 50.35, lng: 7.61 });
  assert.ok(snapshot.candidates.every(item => item.category === "castle"));
});

test("выбранный объект остаётся главным при следующих GPS-обновлениях", () => {
  const core = createMapNaviCore(profile);
  core.setIntent({ type: "object", objectId: "marksburg" });
  core.setPosition({ lat: 50.36, lng: 7.5978 });
  core.setPosition({ lat: 50.30, lng: 7.60 });

  const snapshot = core.getSnapshot();
  assert.equal(snapshot.primaryObject.id, "marksburg");
  assert.equal(snapshot.candidates.length, 1);
});

test("поиск без совпадений не подменяется объектом другой категории", () => {
  const core = createMapNaviCore(profile);
  core.setIntent({ type: "search", query: "объект которого нет" });
  const snapshot = core.getSnapshot();

  assert.equal(snapshot.candidates.length, 0);
  assert.equal(snapshot.primaryObject, null);
  assert.deepEqual(snapshot.activeIntent, { type: "search", query: "объект которого нет" });
});

test("поиск понимает немецкие умлауты и варианты их записи", () => {
  for (const query of ["rüdesheim", "rudesheim", "ruedesheim"]) {
    const core = createMapNaviCore(profile);
    core.setIntent({ type: "search", query });
    assert.ok(
      core.getSnapshot().candidates.some(item => item.id === "ruedesheim"),
      "не найдено по запросу: " + query
    );
  }
});

test("расстояние по прямой рассчитывается формулой гаверсинуса", () => {
  const distance = haversineMeters(0, 0, 0, 1);
  assert.ok(Math.abs(distance - 111195) < 10);
});

test("остановка GPS очищает координаты, но не меняет цель пользователя", () => {
  const core = createMapNaviCore(profile);
  core.setIntent({ type: "category", category: "town" });
  core.setPosition({ lat: 50.36, lng: 7.5978 });
  core.setLocationState("off");

  const snapshot = core.getSnapshot();
  assert.equal(snapshot.position, null);
  assert.deepEqual(snapshot.activeIntent, { type: "category", category: "town" });
});


test("GPS camera policy fits once, then pans only in default Follow", () => {
  const core = createMapNaviCore(profile);
  core.setPosition({ lat: 50.36, lng: 7.5978 });
  assert.equal(getCameraAction(core.getSnapshot(), false), "fit-intent");
  assert.equal(getCameraAction(core.getSnapshot(), true), "pan-user");

  core.setIntent({ type: "category", category: "castle" });
  assert.equal(getCameraAction(core.getSnapshot(), true), "hold");

  core.setIntent({ type: "object", objectId: "marksburg" });
  assert.equal(getCameraAction(core.getSnapshot(), true), "hold");
});

test("GPS camera policy never moves the camera in Free View or before a fix", () => {
  const core = createMapNaviCore(profile);
  assert.equal(getCameraAction(core.getSnapshot(), false), "hold");

  core.setPosition({ lat: 50.36, lng: 7.5978 });
  core.setViewMode("free");
  assert.equal(getCameraAction(core.getSnapshot(), false), "hold");
  assert.equal(getCameraAction(core.getSnapshot(), true), "hold");
});
