import { useRef, useState } from "preact/hooks";
import { CENTER_FOCUS, clampPercent, isCenter } from "../../domain/photoFocus";
import type { PhotoFocus } from "../../domain/types";
import { usePhotoUrl } from "../photos";
import { TEXTS } from "../texts";
import { Cover } from "./Cover";
import { Sheet } from "./Sheet";

const T = TEXTS.form.photos.focus;

/** One arrow key press moves the point by this many percent; with Shift by one. */
const STEP = 5;

interface FocusSheetProps {
  /** Path of the photo in storage. */
  readonly path: string;
  readonly name: string;
  /** The point so far; the middle where none was set. */
  readonly focus: PhotoFocus;
  readonly onSave: (focus: PhotoFocus) => void;
  readonly onClose: () => void;
}

/**
 * Sets which part of a photo matters (the figure): a tap or click on the photo puts the point there,
 * the arrow keys move it. Boxes that fill their area show the photo around this point; the preview
 * below shows what a tile of the showcase will look like.
 */
export function FocusSheet({ path, name, focus, onSave, onClose }: FocusSheetProps) {
  const url = usePhotoUrl(path);
  const [point, setPoint] = useState<PhotoFocus>(focus);
  const area = useRef<HTMLDivElement>(null);

  const place = (clientX: number, clientY: number) => {
    const box = area.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return;
    setPoint({
      x: clampPercent(((clientX - box.left) / box.width) * 100),
      y: clampPercent(((clientY - box.top) / box.height) * 100),
    });
  };

  const move = (dx: number, dy: number) =>
    setPoint((current) => ({
      x: clampPercent(current.x + dx),
      y: clampPercent(current.y + dy),
    }));

  const onKeyDown = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 1 : STEP;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = moves[event.key];
    if (delta) {
      event.preventDefault();
      move(delta[0], delta[1]);
    } else if (event.key === "Home") {
      event.preventDefault();
      setPoint(CENTER_FOCUS);
    }
  };

  return (
    <Sheet
      id="photo-focus"
      title={T.title}
      closeLabel={T.close}
      onClose={onClose}
      footer={(close) => (
        <>
          <button
            type="button"
            class="button button--secondary pressable"
            disabled={isCenter(point)}
            onClick={() => setPoint(CENTER_FOCUS)}
          >
            {T.reset}
          </button>
          <button
            type="button"
            class="button button--primary pressable"
            onClick={() => {
              onSave(point);
              close();
            }}
          >
            {T.done}
          </button>
        </>
      )}
    >
      <p class="card__text" id="photo-focus-hint">
        {T.hint}
      </p>
      {url && (
        // The wrapper is as large as the photo, so the point can be set by its percentages.
        <div
          ref={area}
          class="focus-area"
          role="slider"
          tabIndex={0}
          aria-label={T.areaLabel(name)}
          aria-describedby="photo-focus-hint"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={point.x}
          aria-valuetext={T.valueText(point.x, point.y)}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            place(event.clientX, event.clientY);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              place(event.clientX, event.clientY);
            }
          }}
          onKeyDown={onKeyDown}
        >
          <img class="focus-area__image" src={url} alt="" draggable={false} />
          <span
            class="focus-area__marker"
            aria-hidden="true"
            data-testid="focus-marker"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          />
        </div>
      )}
      <p class="card__text" aria-live="polite">
        {T.valueText(point.x, point.y)}
      </p>
      <div class="focus-preview">
        <Cover
          image={{ kind: "photo", path, focus: point }}
          alt=""
          tintKey={path}
          scribbleId="focus-preview"
          variant="tile"
        />
        <span class="card__text">{T.preview}</span>
      </div>
    </Sheet>
  );
}
