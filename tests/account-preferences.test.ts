import assert from "node:assert/strict";
import test from "node:test";
import { languageChoices, localePattern, preferenceChanges, zoneChoices, zoneDate, zonePattern } from "../src/_pages/account/settings-options";

test("native options keep profile values, include localized choices and allow custom contract values", () => {
  const languages = languageChoices("sr-Latn-RS", ["en-GB", "pt-BR", "en-GB"]);
  assert.equal(languages.find(l => l.value === "ru")?.label, "Русский");
  assert.ok(languages.some(l => l.value === "sr-Latn-RS"));
  assert.equal(languages.filter(l => l.value === "en-GB").length, 1);
  assert.match("fr-CA", new RegExp("^" + localePattern + "$"));
  const zones = zoneChoices("US/Eastern").flatMap(group => group.options);
  assert.ok(zones.some(z => z.value === "US/Eastern"));
  assert.equal(zones.find(z => z.value === "Asia/Bishkek")?.label, "Бишкек");
  assert.ok(zones.some(z => z.value === "UTC"));
  assert.match("Etc/GMT+5", new RegExp("^" + zonePattern + "$"));
});

test("profile patches preserve an unset language and omit unchanged or locked time zones", () => {
  const original = { locale: null, timezone: "Asia/Bishkek" };
  assert.deepEqual(preferenceChanges(original, "", original.timezone, false), {});
  assert.deepEqual(preferenceChanges(original, "", "UTC", false), { timezone: "UTC" });
  assert.deepEqual(preferenceChanges(original, "pt-BR", "UTC", true), { locale: "pt-BR" });
  assert.deepEqual(preferenceChanges({ ...original, locale: "sr-Latn-RS" }, "sr-Latn-RS", "Etc/UTC", false), { timezone: "Etc/UTC" });
});

test("cooldown dates use the account zone and invalid timestamps are omitted", () => {
  assert.equal(zoneDate("bad-date", "Asia/Bishkek"), "");
  assert.match(zoneDate("2026-11-20T04:02:00Z", "Asia/Bishkek"), /10:02/);
  assert.match(zoneDate("2026-11-20T04:02:00Z", "Asia/Bishkek", true), /UTC\+6/);
});
