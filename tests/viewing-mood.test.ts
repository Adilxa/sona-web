import { strict as assert } from "node:assert";
import { test } from "node:test";
import { isViewingMood, matchingMoodTerm } from "../src/features/viewing-mood/model";

test("mood recommendations use the actual matching genre or tag, including a translated term", () => {
  const genre = { id: 2, name: "Фэнтези", slug: "fantasy" };
  const tag = { id: 9, name: "Романтическая комедия", slug: "romantic-comedy" };
  const card = { genres: [genre], tags: [tag] };
  assert.equal(matchingMoodTerm("joy", card), tag);
  assert.equal(matchingMoodTerm("thrill", card), genre);
  assert.equal(matchingMoodTerm("wistful", card), undefined);
});

test("partial term names and invalid stored choices cannot silently select a mood", () => {
  const term = { id: 3, name: "Пародия на триллер", slug: "thriller-parody" };
  assert.equal(matchingMoodTerm("thrill", { genres: [], tags: [term] }), undefined);
  assert.equal(isViewingMood("__proto__"), false);
  assert.equal(isViewingMood("joy"), true);
});
