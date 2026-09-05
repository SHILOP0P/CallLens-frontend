import assert from "node:assert/strict";
import { test } from "node:test";
import { splitRedactedWord, wordNeedsLeadingSpace } from "../src/shared/lib/transcript.ts";
import { transcriptIslandLayout } from "../src/features/calls/transcript-island-layout.ts";

test("mask keeps punctuation and quotes outside its decoration", () => {
  for (const text of ["[ИМЯ].", "«[ИМЯ]»,", "[ИМЯ]", "[ИМЯ]?!"]) {
    const parts = splitRedactedWord(text, "[ИМЯ]");
    assert.ok(parts);
    assert.equal(parts.marker, "[ИМЯ]");
    assert.equal(parts.before + parts.marker + parts.after, text);
  }
  assert.equal(splitRedactedWord("Неизменённый текст", "[ИМЯ]"), null);
  assert.equal(splitRedactedWord("обычное слово"), null);
  assert.equal(wordNeedsLeadingSpace("[ИМЯ].", 1), true);
  assert.equal(wordNeedsLeadingSpace(".", 2), false);
});

const card = { left: 600, right: 1100, top: 200, bottom: 2200 };
const clip = { left: 300, right: 1400, top: 120, bottom: 850 };

test("floating collapse control follows the transcript, not the viewport centre", () => {
  assert.deepEqual(transcriptIslandLayout(card, clip, 2000, 42), { left: 850, bottom: 840, maxWidth: 476, collision: 0 });
  const shifted = { ...card, left: 780, right: 1280 };
  assert.equal(transcriptIslandLayout(shifted, clip, 2000, 42)?.left, 1030);
});

test("floating control stays hidden outside the transcript or before valid geometry", () => {
  assert.equal(transcriptIslandLayout({ ...card, top: 900 }, clip, 2000, 42), null);
  assert.equal(transcriptIslandLayout({ ...card, bottom: 100 }, clip, 50, 42), null);
  assert.equal(transcriptIslandLayout({ ...card, left: 1500, right: 2000 }, clip, 2000, 42), null);
  assert.equal(transcriptIslandLayout({ ...card, right: NaN }, clip, 2000, 42), null);
  assert.equal(transcriptIslandLayout({ ...card, bottom: NaN }, clip, 2000, 42), null);
  assert.equal(transcriptIslandLayout(card, clip, 2000, 0), null);
  assert.equal(transcriptIslandLayout(card, { ...clip, bottom: 240 }, 2000, 42), null);
});

test("the regular collapse button takes over and mobile navigation is not covered", () => {
  assert.equal(transcriptIslandLayout(card, clip, 840, 42), null);
  assert.equal(transcriptIslandLayout(card, clip, 888, 42)?.collision, .5);
  const mobileClip = { left: 0, right: 390, top: 100, bottom: 690 };
  const mobileCard = { left: 12, right: 378, top: 120, bottom: 1900 };
  assert.deepEqual(transcriptIslandLayout(mobileCard, mobileClip, 1800, 42), { left: 195, bottom: 680, maxWidth: 342, collision: 0 });
});
