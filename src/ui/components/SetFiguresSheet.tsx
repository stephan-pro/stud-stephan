import type { CatalogItem } from "../../backend/catalog";
import type { CatalogFigure, WishItem } from "../../domain/types";
import type { WishableFigure } from "../../domain/wishForm";
import { TEXTS } from "../texts";
import { Cover } from "./Cover";
import { Sheet } from "./Sheet";

const T = TEXTS.wishCapture.setFigures;

interface SetFiguresSheetProps {
  readonly item: CatalogItem;
  readonly rows: readonly WishableFigure[];
  /** Whether the set itself is on the wishlist already. */
  readonly setWished: boolean;
  readonly onFigure: (figure: CatalogFigure, wish: WishItem | undefined) => void;
  readonly onSet: () => void;
  readonly onClose: () => void;
}

/** The figures of the set a wish was searched for, each with "+ Wunschliste", and "Ganzes Set wünschen". */
export function SetFiguresSheet({
  item,
  rows,
  setWished,
  onFigure,
  onSet,
  onClose,
}: SetFiguresSheetProps) {
  const meta = [item.number, item.theme].filter(Boolean).join(" · ");
  return (
    <Sheet
      id="set-figures"
      title={T.title}
      closeLabel={T.close}
      onClose={onClose}
      footerLayout="stack"
      footer={() => (
        <button class="button button--primary pressable" type="button" onClick={onSet}>
          {setWished ? T.wholeSetWished : T.wholeSet}
        </button>
      )}
    >
      <p class="card__text">
        <strong>{item.name}</strong>
        {meta && <> · {meta}</>}
      </p>
      <p class="note">{T.intro(rows.length)}</p>
      <ul class="search-hits" aria-label={T.listLabel}>
        {rows.map(({ figure, owned, wish }, index) => {
          const quantity =
            figure.quantity && figure.quantity > 1 ? T.quantity(figure.quantity) : "";
          const key = `${figure.bricklinkId ?? figure.name}-${index}`;
          return (
            <li key={key} class="search-hit set-figure">
              <Cover
                image={figure.imageUrl ? { kind: "catalog", url: figure.imageUrl } : undefined}
                alt=""
                tintKey={key}
                scribbleId={`set-figure-${index}`}
                variant="small"
              />
              <span class="search-hit__text">
                <span class="search-hit__name">{figure.name}</span>
                <span class="search-hit__facts">
                  {[figure.bricklinkId, quantity].filter(Boolean).join(" · ")}
                </span>
              </span>
              {owned && <span class="pill">{T.owned}</span>}
              {wish ? (
                <button
                  type="button"
                  class="chip chip--small pressable"
                  aria-label={T.wishedLabel(figure.name)}
                  onClick={() => onFigure(figure, wish)}
                >
                  {T.wished}
                </button>
              ) : (
                <button
                  type="button"
                  class="chip chip--small pressable"
                  aria-label={T.addLabel(figure.name)}
                  onClick={() => onFigure(figure, undefined)}
                >
                  {T.add}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
