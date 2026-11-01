import { useState } from "preact/hooks";
import { formatMonth } from "../../domain/dates";
import {
  dioramaOf,
  findItem,
  otherCopies,
  ownSetOf,
  setFigureProgress,
  setFigures,
} from "../../domain/details";
import { formatMoney } from "../../domain/money";
import { priceHistory } from "../../domain/prices";
import { galleryImages, shortSetNumber } from "../../domain/showcase";
import type { Collection, LegoSet, Minifig, ShowcaseItem, SpecialPart } from "../../domain/types";
import { modSpend, valueOfItem } from "../../domain/value";
import { CopyRow } from "../components/CopyRow";
import { Cover } from "../components/Cover";
import { BackBar, NoteAndLinks, originRows, Rows, Section } from "../components/DetailParts";
import { Gallery } from "../components/Gallery";
import { Icon } from "../components/Icon";
import { RemoveSheet } from "../components/RemoveSheet";
import { ValueCard } from "../components/ValueCard";
import { manufacturerLabel, safeUrl } from "../labels";
import { type DetailRef, detailHash, formHash, routeHash } from "../route";
import { TEXTS } from "../texts";
import type { LoadedCollection } from "../useCollection";

const T = TEXTS.detail;

/** Name, meta line and chips under the gallery. */
function Title({
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
}: {
  readonly minifig: Minifig;
  readonly collection: Collection;
}) {
  const valuation = valueOfItem(minifig, collection.prices);
  const set = ownSetOf(collection, minifig);
  const diorama = dioramaOf(collection, minifig);
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
      <Section id="diorama" title={T.diorama.title}>
        {diorama ? (
          <div class="diorama-row">
            <Cover
              image={diorama.photos[0] ? { kind: "photo", path: diorama.photos[0] } : undefined}
              alt=""
              tintKey={diorama.id}
              scribbleId={`diorama-${diorama.id}`}
              variant="small"
            />
            <span class="copy-row__name">{diorama.name}</span>
          </div>
        ) : (
          <p class="card__text">{T.diorama.none}</p>
        )}
      </Section>
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
}: {
  readonly set: LegoSet;
  readonly collection: Collection;
}) {
  const valuation = valueOfItem(set, collection.prices);
  const figures = setFigures(collection, set);
  const progress = setFigureProgress(figures);
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
                    <div class="figure-tile figure-tile--missing">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
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
  return (
    <>
      <a
        class="icon-button pressable"
        href={formHash({ type: item.type, mode: "edit", id: item.id })}
        aria-label={A.edit}
      >
        <Icon name="edit" />
      </a>
      {item.type === "minifig" && (
        <a
          class="icon-button pressable"
          href={formHash({ type: "minifig", mode: "copy", id: item.id })}
          aria-label={A.copy}
        >
          <Icon name="copy" />
        </a>
      )}
      <button type="button" class="icon-button pressable" aria-label={A.remove} onClick={onRemove}>
        <Icon name="trash" />
      </button>
    </>
  );
}

/** S2, S3 and S4: the detail page of a figure, a set or a special part. */
export function DetailPage({
  data,
  detail,
  onRemove,
}: {
  readonly data: LoadedCollection;
  readonly detail: DetailRef;
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
      {item?.type === "minifig" && <MinifigDetail minifig={item} collection={state.collection} />}
      {item?.type === "legoSet" && <SetDetail set={item} collection={state.collection} />}
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
