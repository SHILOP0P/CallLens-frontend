import assert from "node:assert/strict";
import { test } from "node:test";
import { sparklineCoordinates, SPARKLINE_WIDTH, SPARKLINE_HEIGHT } from "../src/features/overview/sparkline-geometry.ts";

test("hit centres match SVG points at every card width, including both ends", () => {
  const points = sparklineCoordinates([0, 4, 8, 2, 3].map(value => ({ value })));
  for (const width of [120, 160, 300, 540]) {
    for (const height of [42, 52, 80]) {
      for (const point of points) {
        assert.ok(Math.abs(point.left / 100 * width - point.x / SPARKLINE_WIDTH * width) < 1e-9);
        assert.ok(Math.abs(point.top / 100 * height - point.y / SPARKLINE_HEIGHT * height) < 1e-9);
      }
    }
  }
  assert.equal(points[0].left, 6.25);
  assert.equal(points.at(-1)?.left, 92.5);
});
test("one data point is centred, empty input stays empty", () => {
  assert.deepEqual(sparklineCoordinates([]), []);
  assert.equal(sparklineCoordinates([{ value: 12 }])[0].left, 50);
});
test("flat and negative series have finite coordinates inside the SVG", () => {
  for (const values of [[0, 0], [4, 4], [-8, -2, 0, 5]]) {
    for (const point of sparklineCoordinates(values.map(value => ({ value })))) {
      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
      assert.ok(point.y >= 8 && point.y <= 46);
    }
  }
});
