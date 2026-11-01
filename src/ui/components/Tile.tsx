import { formatMoney } from "../../domain/money";
import {
  coverImage,
  entryItems,
  type ShowcaseEntry,
  shortSetNumber,
  type TileFacts,
} from "../../domain/showcase";
import { manufacturerLabel } from "../labels";
import { detailHash } from "../route";
import { TEXTS } from "../texts";
import { Cover } from "./Cover";

interface TileProps {
  readonly entry: ShowcaseEntry;
  readonly facts: TileFacts;
  /** Opens the choice of copies for a tile with several (×3). */
  readonly onChooseCopy: (
    entry: Extract<ShowcaseEntry, { type: "minifig" }>,
    opener: HTMLElement,
  ) => void;
}

/** The small grey line under the name: number or maker, then theme or status (as in the dummy). */
function metaLine(entry: ShowcaseEntry, facts: TileFacts): string {
  let parts: (string | undefined)[];
  if (entry.type === "legoSet") {
    parts = [
      facts.number ? shortSetNumber(facts.number) : undefined,
      TEXTS.setStatus[entry.item.status],
    ];
  } else if (entry.type === "specialPart") {
    parts = [TEXTS.specialPartKinds[entry.item.kind].chip, facts.theme];
  } else {
    const maker =
      facts.manufacturer.kind === "lego" ? undefined : manufacturerLabel(facts.manufacturer);
    parts = [facts.number ?? maker, facts.theme];
  }
  return parts.filter(Boolean).join(" · ");
}

/** A tile of the showcase grid (S1): photo with markers, name, meta line and value. */
export function Tile({ entry, facts, onChooseCopy }: TileProps) {
  const T = TEXTS.showcase.tile;
  const items = entryItems(entry);
  const first = items[0];
  if (!first) return null;

  const markers: { text: string; dark?: boolean }[] = [];
  if (facts.copies > 1) markers.push({ text: T.copies(facts.copies), dark: true });
  if (facts.modified) markers.push({ text: T.modified });
  if (facts.withoutDiorama) markers.push({ text: T.withoutDiorama });
  if (entry.type === "legoSet") markers.push({ text: T.set });
  if (entry.type === "specialPart") {
    markers.push({ text: TEXTS.specialPartKinds[entry.item.kind].chip });
  }

  const body = (
    <>
      <Cover
        image={coverImage(entry)}
        alt=""
        tintKey={entry.key}
        scribbleId={`tile-${entry.key}`}
        variant="tile"
      >
        {markers.length > 0 && (
          <div class="tile__markers">
            {markers.map((marker) => (
              <span key={marker.text} class={marker.dark ? "marker marker--dark" : "marker"}>
                {marker.text}
              </span>
            ))}
          </div>
        )}
      </Cover>
      <div class="tile__text">
        <span class="tile__name">{facts.name}</span>
        <span class="tile__meta">{metaLine(entry, facts)}</span>
        <span class="tile__value">
          {facts.valueMissing ? T.withoutValue : formatMoney(facts.cents)}
        </span>
      </div>
    </>
  );

  if (entry.type === "minifig" && entry.copies.length > 1) {
    return (
      <button
        type="button"
        class="tile pressable"
        onClick={(event) => onChooseCopy(entry, event.currentTarget)}
      >
        {body}
      </button>
    );
  }
  return (
    <a class="tile pressable" href={detailHash({ type: entry.type, id: first.id })}>
      {body}
    </a>
  );
}
