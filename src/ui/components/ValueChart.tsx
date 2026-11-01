import type { ValuePoint } from "../../domain/valueHistory";
import { chartMarks, describeChart } from "../chartText";

const WIDTH = 318;
const HEIGHT = 110;
/** Room above and below the line so that neither the line nor the end dot is cut off. */
const MARGIN = 8;

/** The x of a day: points sit where their day falls in time, not at even distances. */
function xOf(date: string, first: string, span: number): number {
  return span === 0 ? WIDTH : ((Date.parse(date) - Date.parse(first)) / span) * (WIDTH - MARGIN);
}

/**
 * The line of the total value as in `Dashboard.dc.html`: an own SVG without a chart library. One
 * point per run day, no smoothing, nothing between the points. Needs two points or more.
 */
export function ValueChart({ points }: { readonly points: readonly ValuePoint[] }) {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last || points.length < 2) return null;
  const low = Math.min(...points.map((point) => point.cents));
  const high = Math.max(...points.map((point) => point.cents));
  const range = Math.max(high - low, 1);
  const span = Date.parse(last.date) - Date.parse(first.date);
  const coordinates = points.map((point) => ({
    x: xOf(point.date, first.date, span),
    y: HEIGHT - MARGIN - ((point.cents - low) / range) * (HEIGHT - 2 * MARGIN),
  }));
  const end = coordinates.at(-1);
  return (
    <>
      <div class="value-chart">
        <svg
          class="value-chart__line"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={describeChart(points)}
          preserveAspectRatio="none"
        >
          <polyline
            points={coordinates.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}
            fill="none"
            vector-effect="non-scaling-stroke"
          />
        </svg>
        {end && (
          <span
            class="value-chart__dot"
            aria-hidden="true"
            style={{ left: `${(end.x / WIDTH) * 100}%`, top: `${(end.y / HEIGHT) * 100}%` }}
          />
        )}
      </div>
      <p class="value-chart__marks" aria-hidden="true">
        {chartMarks(points).map((mark, index) => (
          <span key={`${index}-${mark}`}>{mark}</span>
        ))}
      </p>
    </>
  );
}
