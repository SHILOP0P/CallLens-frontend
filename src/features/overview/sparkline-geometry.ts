export const SPARKLINE_WIDTH = 160;
export const SPARKLINE_HEIGHT = 52;

// SVG and HTML hit targets share one coordinate system. The SVG uses
// preserveAspectRatio="none" to follow the container's full size.
export function sparklineCoordinates<T extends { value: number }>(points: readonly T[]) {
  const maximum = Math.max(...points.map(point => point.value), 1);
  const minimum = Math.min(...points.map(point => point.value), 0);
  const range = Math.max(1, maximum - minimum);
  return points.map((point, index) => {
    const x = points.length === 1 ? SPARKLINE_WIDTH / 2 : 10 + index * 138 / (points.length - 1);
    const y = Math.max(8, Math.min(46, 44 - (point.value - minimum) / range * 34));
    return { ...point, x, y, left: x / SPARKLINE_WIDTH * 100, top: y / SPARKLINE_HEIGHT * 100 };
  });
}
