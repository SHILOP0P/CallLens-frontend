import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// SelectControl portals carry app-shell for scoped menu styles. Both shared
// and dark-theme page decorations must explicitly exclude those portal hosts.
for (const sheet of ["components", "themes"]) {
  test(`${sheet}: select portals do not receive viewport background layers`, () => {
    const css = readFileSync(new URL(`../src/styles/${sheet}.css`, import.meta.url), "utf8");
    assert.doesNotMatch(css, /\.app-shell\s*::(?:before|after)\b/);
    for (const pseudo of ["before", "after"]) {
      assert.ok(css.includes(`.app-shell:not(.select-menu-portal-root)::${pseudo}`));
    }
  });
}
