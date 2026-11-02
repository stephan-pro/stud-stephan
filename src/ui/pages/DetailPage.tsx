import { useState } from "preact/hooks";
import type { Remote } from "../../backend/remote";
import { formatMonth } from "../../domain/dates";
import {
  findItem,
  otherCopies,
  ownSetOf,
  setFigureProgress,
  setFigures,
} from "../../domain/details";
import { formatMoney } from "../../domain/money";
import { figuresInSet } from "../../domain/placement";
import { priceHistory } from "../../domain/prices";
import { galleryImages, shortSetNumber } from "../../domain/showcase";
import type {
  CatalogFigure,
  Collection,
  LegoSet,
  Minifig,
  ShowcaseItem,
  SpecialPart,
} from "../../domain/types";
import { modSpend, valueOfItem } from "../../domain/value";
import {
  newWishValues,
  wishForFigure,
  wishSourceOfFigure,
  wishValuesOf,
} from "../../domain/wishForm";
import { CopyRow } from "../components/CopyRow";
import { Cover } from "../components/Cover";
import { BackBar, NoteAndLinks, originRows, Rows, Section } from "../components/DetailParts";
import { FigureStand } from "../components/FigureStand";
import { Gallery } from "../components/Gallery";
import { Icon } from "../components/Icon";
import { RemoveSheet } from "../components/RemoveSheet";
import { ValueCard } from "../components/ValueCard";
import { WishSheet } from "../components/WishSheet";
import { WriteLink } from "../components/WriteLink";
import { manufacturerLabel, safeUrl } from "../labels";
import { type DetailRef, detailHash, formHash, routeHash, setAssignHash } from "../route";
import { TEXTS } from "../texts";
import { type LoadedCollection, useWritable } from "../useCollection";
import { wishActions } from "../wishActions";

const T = TEXTS.detail;

/** Name, meta line and chips under the gallery. */
export function Title({
  name,
  meta,
  chips,
}: {
  readonly name: string;
  readonly meta: string;
  readonly chips: readonly { text: string; pop?: boolean }[];
}) {
  return (
    <div class="detail-title">
      <h1 class="page-title" tabIndex={-1}>
        {name}
      </h1>
      <p class="detail-title__meta">{meta}</p>
      <ul class="pills">
        {chips.map((chip) => (
          <li key={chip.text} class={chip.pop ? "pill pill--pop" : "pill"}>
            {chip.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MinifigDetail({
  minifig,
  collection,
  remote,
  update,
}: {
  readonly minifig: Minifig;
  readonly collection: Collection;
  readonly remote: Remote | undefined;
  readonly update: LoadedCollection["update"];
}) {
  const valuation = valueOfItem(minifig, collection.prices);
  const set = ownSetOf(collection, minifig);
  const copies = otherCopies(collection, minifig);
  const fromSetLabel = minifig.fromSet?.label ?? set?.name;
  const rows = originRows([
    { label: T.origin.source, value: minifig.source },
    {
      label: T.origin.acquired,
      value: minifig.acquiredOn ? formatMonth(minifig.acquiredOn) : undefined,
    },
    {
      label: T.origin.purchasePrice,
      value: minifig.purchasePrice === undefined ? undefined : formatMoney(minifig.purchasePrice),
    },
    {
      label: T.origin.fromSet,
      value: set ? (
        <a href={detailHash({ type: "legoSet", id: set.id })}>{fromSetLabel}</a>
      ) : (
        fromSetLabel
      ),
    },
  ]);
  const meta = [minifig.bricklinkId, manufacturerLabel(minifig.manufacturer), minifig.theme].filter(
    Boolean,
  );

  return (
    <>
      <Gallery images={galleryImages(minifig)} name={minifig.name} id={minifig.id} />
      <Title
        name={minifig.name}
        meta={meta.join(" · ")}
        chips={[
          { text: TEXTS.conditions[minifig.condition] },
          ...(minifig.mods.length > 0 ? [{ text: T.modified, pop: true }] : []),
        ]}
      />
      <ValueCard
        id="value"
        type="minifig"
        valuation={valuation}
        condition={minifig.condition}
        purchasePrice={minifig.purchasePrice}
        history={priceHistory(minifig, minifig.condition, collection.prices)}
      />
      {rows.length > 0 && (
        <Section id="origin" title={T.origin.title}>
          <Rows rows={rows} />
        </Section>
      )}
      <FigureStand minifig={minifig} collection={collection} remote={remote} update={update} />
      {minifig.mods.length > 0 && (
        <Section
          id="mods"
          title={T.mods.title}
          badge={<span class="pill pill--pop">{T.mods.count(minifig.mods.length)}</span>}
        >
          <ul class="mod-list">
            {minifig.mods.map((part) => {
              const vendorUrl = safeUrl(part.url);
              const vendor =
                part.vendor && vendorUrl ? (
                  <a href={vendorUrl} target="_blank" rel="noopener noreferrer">
                    {part.vendor}
                  </a>
                ) : (
                  part.vendor
                );
              return (
                <li key={part.id} class="mod-list__item">
                  <div class="mod-list__text">
                    <span class="mod-list__position">{TEXTS.modPositions[part.position]}</span>
                    <span class="tile__meta">
                      {part.description}
                      {vendor ? <> · {vendor}</> : null}
                      {part.originalPart ? ` · ${T.mods.original(part.originalPart)}` : ""}
                    </span>
                  </div>
                  {part.price !== undefined && (
                    <span class="mod-list__price">{formatMoney(part.price)}</span>
                  )}
                </li>
              );
            })}
          </ul>
          <div class="mod-total">
            <div class="mod-total__text">
              <span class="mod-list__position">{T.mods.spend}</span>
              <span class="tile__meta">{T.mods.notInValue}</span>
            </div>
            <span class="mod-total__amount">{formatMoney(modSpend(minifig))}</span>
          </div>
        </Section>
      )}
      <Section id="copies" title={T.copies.title}>
        <p class="card__text">
          {copies.length === 0 ? T.copies.once : T.copies.several(copies.length + 1)}
        </p>
        {copies.length > 0 && (
          <ul class="copy-list">
            {copies.map((copy) => (
              <li key={copy.id}>
                <CopyRow copy={copy} prices={collection.prices} />
              </li>
            ))}
          </ul>
        )}
      </Section>
      <NoteAndLinks item={minifig} />
    </>
  );
}

function SetDetail({
  set,
  collection,
  remote,
  update,
}: {
  readonly set: LegoSet;
  readonly collection: Collection;
  readonly remote: Remote | undefined;
  readonly update: LoadedCollection["update"];
}) {
  /** The missing figure whose wish sheet is open (F13: from a figure of the set to the wishlist). */
  const [wishing, setWishing] = useState<CatalogFigure | undefined>();
  const wishingWish = wishing ? wishForFigure(collection.wishlist, wishing.bricklinkId) : undefined;
  const valuation = valueOfItem(set, collection.prices);
  const figures = setFigures(collection, set);
  const progress = setFigureProgress(figures);
  const displayed = figuresInSet(collection, set.id);
  const meta = [
    set.setNumber ? shortSetNumber(set.setNumber) : undefined,
    manufacturerLabel(set.manufacturer),
    set.theme,
    set.year,
  ].filter(Boolean);
  const origin = originRows([
    { label: T.origin.source, value: set.source },
    {
      label: T.origin.acquired,
      value: set.acquiredOn ? formatMonth(set.acquiredOn) : undefined,
    },
    {
      label: T.origin.purchasePrice,
      value: set.purchasePrice === undefined ? undefined : formatMoney(set.purchasePrice),
    },
  ]);
  const facts = originRows([
    { label: T.set.pieces, value: set.pieceCount?.toLocaleString("de-DE") },
    { label: T.set.figures, value: set.minifigCount?.toString() },
  ]);

  return (
    <>
      <Gallery images={galleryImages(set)} name={set.name} id={set.id} />
      <Title
        name={set.name}
        meta={meta.join(" · ")}
        chips={[
          { text: TEXTS.conditions[set.condition] },
          { text: TEXTS.setStatus[set.status], pop: true },
        ]}
      />
      <ValueCard
        id="value"
        type="legoSet"
        valuation={valuation}
        condition={set.condition}
        purchasePrice={set.purchasePrice}
        history={priceHistory(set, set.condition, collection.prices)}
      />
      <Section
        id="figures"
        title={T.set.figuresTitle}
        badge={
          figures.length > 0 && (
            <span
              class="pill"
              role="img"
              aria-label={T.set.progressLabel(progress.have, progress.total)}
            >
              {T.set.progress(progress.have, progress.total)}
            </span>
          )
        }
      >
        {figures.length === 0 ? (
          <p class="card__text">{T.set.noFigures}</p>
        ) : (
          <ul class="figure-grid">
            {figures.map(({ figure, owned }, index) => {
              const first = owned[0];
              const quantity =
                figure.quantity && figure.quantity > 1 ? T.set.quantity(figure.quantity) : "";
              const key = `${figure.bricklinkId ?? figure.name}-${index}`;
              const body = (
                <>
                  <Cover
                    image={figure.imageUrl ? { kind: "catalog", url: figure.imageUrl } : undefined}
                    alt=""
                    tintKey={key}
                    scribbleId={`figure-${set.id}-${index}`}
                    variant="small"
                  />
                  <span class="figure-tile__name">{figure.name}</span>
                  <span class="tile__meta">
                    {first ? quantity : `${T.set.missing} ${quantity}`.trim()}
                  </span>
                </>
              );
              return (
                <li key={key}>
                  {first ? (
                    <a
                      class="figure-tile pressable"
                      href={detailHash({ type: "minifig", id: first.id })}
                    >
                      {body}
                    </a>
                  ) : (
                    <div class="figure-tile figure-tile--missing">
                      {body}
                      {figure.bricklinkId && (
                        <button
                          type="button"
                          class="chip chip--small pressable"
                          aria-label={
                            wishForFigure(collection.wishlist, figure.bricklinkId)
                              ? `${figure.name}: ${TEXTS.wishSheet.titleEdit}`
                              : T.set.addWishLabel(figure.name)
                          }
                          onClick={() => setWishing(figure)}
                        >
                          {wishForFigure(collection.wishlist, figure.bricklinkId)
                            ? TEXTS.wishSheet.titleEdit
                            : T.set.addWish}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
      <Section id="displayed" title={T.set.displayedTitle}>
        {displayed.length === 0 ? (
          <p class="card__text">{T.set.displayedNone}</p>
        ) : (
          <ul class="figure-grid figure-grid--round">
            {displayed.map(({ minifig, automatic }) => (
              <li key={minifig.id}>
                <a
                  class="figure-tile pressable"
                  href={detailHash({ type: "minifig", id: minifig.id })}
                >
                  <Cover
                    image={galleryImages(minifig)[0]}
                    alt=""
                    tintKey={minifig.id}
                    scribbleId={`displayed-${minifig.id}`}
                    variant="small"
                  />
                  <span class="figure-tile__name">{minifig.name}</span>
                  {automatic && <span class="tile__meta">{T.set.displayedAutomatic}</span>}
                </a>
              </li>
            ))}
          </ul>
        )}
        <WriteLink class="button button--pop pressable" href={setAssignHash(set.id)}>
          <Icon name="plus" size={20} />
          {T.set.displayedAssign}
        </WriteLink>
      </Section>
      {facts.length > 0 && (
        <Section id="set" title={T.set.title}>
          <Rows rows={facts} />
        </Section>
      )}
      {origin.length > 0 && (
        <Section id="origin" title={T.origin.title}>
          <Rows rows={origin} />
        </Section>
      )}
      <NoteAndLinks item={set} />
      {wishing && (
        <WishSheet
          source={wishSourceOfFigure(wishing, { theme: set.theme })}
          initial={wishingWish ? wishValuesOf(wishingWish) : newWishValues("minifig")}
          existing={wishingWish}
          prices={collection.prices}
          actions={wishActions(remote, update)}
          onClose={() => setWishing(undefined)}
          onReceived={
            wishingWish
              ? () => {
                  location.hash = formHash({ type: "minifig", mode: "wish", id: wishingWish.id });
                }
              : undefined
          }
        />
      )}
    </>
  );
}

function SpecialPartDetail({
  part,
  collection,
}: {
  readonly part: SpecialPart;
  readonly collection: Collection;
}) {
  const kind = TEXTS.specialPartKinds[part.kind];
  const meta = [manufacturerLabel(part.manufacturer), part.theme].filter(Boolean);
  const rows = originRows([
    { label: T.origin.kind, value: kind.long },
    { label: T.origin.number, value: part.number },
    {
      label: T.origin.bricklinkType,
      value: part.bricklinkType ? TEXTS.search.bricklinkTypes[part.bricklinkType] : undefined,
    },
    { label: T.origin.year, value: part.year === undefined ? undefined : String(part.year) },
    { label: T.origin.source, value: part.source },
    {
      label: T.origin.acquired,
      value: part.acquiredOn ? formatMonth(part.acquiredOn) : undefined,
    },
    {
      label: T.origin.purchasePrice,
      value: part.purchasePrice === undefined ? undefined : formatMoney(part.purchasePrice),
    },
  ]);
  return (
    <>
      <Gallery images={galleryImages(part)} name={part.name} id={part.id} />
      <Title
        name={part.name}
        meta={meta.join(" · ")}
        chips={[{ text: kind.chip, pop: true }, { text: TEXTS.conditions[part.condition] }]}
      />
      <ValueCard
        id="value"
        type="specialPart"
        valuation={valueOfItem(part, collection.prices)}
        condition={part.condition}
        purchasePrice={part.purchasePrice}
        history={priceHistory(part, part.condition, collection.prices)}
      />
      <Section id="origin" title={T.origin.title}>
        <Rows rows={rows} />
      </Section>
      <NoteAndLinks item={part} />
    </>
  );
}

/** What the detail page of this object is called (the tab title); undefined while unknown. */
export function detailName(data: LoadedCollection, detail: DetailRef): string | undefined {
  return data.state.status === "ready"
    ? findItem(data.state.collection, detail.type, detail.id)?.name
    : undefined;
}

/** Edit, another copy (figures only) and delete: icon buttons at the top right (S2, S3, S4). */
function Actions({
  item,
  onRemove,
}: {
  readonly item: ShowcaseItem;
  readonly onRemove: () => void;
}) {
  const A = TEXTS.actions;
  const writable = useWritable();
  return (
    <>
      <WriteLink
        class="icon-button pressable"
        href={formHash({ type: item.type, mode: "edit", id: item.id })}
        label={A.edit}
      >
        <Icon name="edit" />
      </WriteLink>
      {item.type === "minifig" && (
        <WriteLink
          class="icon-button pressable"
          href={formHash({ type: "minifig", mode: "copy", id: item.id })}
          label={A.copy}
        >
          <Icon name="copy" />
        </WriteLink>
      )}
      <button
        type="button"
        class="icon-button pressable"
        aria-label={writable ? A.remove : `${A.remove} – ${TEXTS.readOnlyShort}`}
        title={writable ? undefined : TEXTS.readOnlyShort}
        disabled={!writable}
        onClick={onRemove}
      >
        <Icon name="trash" />
      </button>
    </>
  );
}

/** S2, S3 and S4: the detail page of a figure, a set or a special part. */
export function DetailPage({
  data,
  detail,
  remote,
  onRemove,
}: {
  readonly data: LoadedCollection;
  readonly detail: DetailRef;
  readonly remote: Remote | undefined;
  /** Called when the person has confirmed deleting the object. */
  readonly onRemove: (item: ShowcaseItem) => void;
}) {
  const { state } = data;
  const [asking, setAsking] = useState(false);
  if (state.status !== "ready") {
    return (
      <>
        <BackBar />
        {state.status === "loading" ? (
          <div class="skeleton" role="status" aria-label={TEXTS.showcase.loading} aria-busy="true">
            <div class="skeleton__hero" />
            <div class="skeleton__card" />
          </div>
        ) : (
          <section class="card" role="alert" aria-labelledby="load-failed-title">
            <h1 class="card__title" id="load-failed-title" tabIndex={-1}>
              {TEXTS.showcase.loadFailed.title}
            </h1>
            <p class="card__text">{TEXTS.showcase.loadFailed.text}</p>
            <button type="button" class="button button--secondary pressable" onClick={data.retry}>
              {TEXTS.showcase.loadFailed.retry}
            </button>
          </section>
        )}
      </>
    );
  }
  const item = findItem(state.collection, detail.type, detail.id);
  return (
    <>
      <BackBar>{item && <Actions item={item} onRemove={() => setAsking(true)} />}</BackBar>
      {item && asking && (
        <RemoveSheet
          item={item}
          onConfirm={() => onRemove(item)}
          onClose={() => setAsking(false)}
        />
      )}
      {item?.type === "minifig" && (
        <MinifigDetail
          minifig={item}
          collection={state.collection}
          remote={remote}
          update={data.update}
        />
      )}
      {item?.type === "legoSet" && (
        <SetDetail set={item} collection={state.collection} remote={remote} update={data.update} />
      )}
      {item?.type === "specialPart" && (
        <SpecialPartDetail part={item} collection={state.collection} />
      )}
      {!item && (
        <section class="card" aria-labelledby="not-found-title">
          <h1 class="card__title" id="not-found-title" tabIndex={-1}>
            {T.notFound.title}
          </h1>
          <p class="card__text">{T.notFound.text}</p>
          <a class="button button--secondary pressable" href={routeHash("showcase")}>
            {T.back}
          </a>
        </section>
      )}
    </>
  );
}
