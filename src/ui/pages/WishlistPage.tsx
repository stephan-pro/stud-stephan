import { useState } from "preact/hooks";
import type { Remote } from "../../backend/remote";
import { formatMoney } from "../../domain/money";
import type { WishItem } from "../../domain/types";
import { wishValuesOf } from "../../domain/wishForm";
import { arrangeWishlist, type WishSort, type WishStatus, wishStatus } from "../../domain/wishlist";
import { Cover } from "../components/Cover";
import { Icon } from "../components/Icon";
import { Scribbles } from "../components/Scribbles";
import { Sheet } from "../components/Sheet";
import { Unready } from "../components/Unready";
import { WishSheet } from "../components/WishSheet";
import { formHash, routeHash, seriesHash } from "../route";
import { TEXTS } from "../texts";
import { type LoadedCollection, useWritable } from "../useCollection";
import { type WishActions, wishActions } from "../wishActions";

const T = TEXTS.wishlist;
const SORTS: readonly WishSort[] = ["priority", "price", "name"];

/** The switch under the heading: wishes or series (S9, S10). */
export function WishSwitch({ current }: { readonly current: "wishes" | "series" }) {
  return (
    <nav class="page-switch" aria-label={T.switchLabel}>
      <a
        class="page-switch__option pressable"
        href={routeHash("wishlist")}
        aria-current={current === "wishes" ? "page" : undefined}
      >
        {T.tabs.wishes}
      </a>
      <a
        class="page-switch__option pressable"
        href={seriesHash({ kind: "list" })}
        aria-current={current === "series" ? "page" : undefined}
      >
        {T.tabs.series}
      </a>
    </nav>
  );
}

/** "sw0196 · gebraucht", "Set · neu" or "sw0001 · aus Reihe Star Wars – The Clone Wars". */
function subline(wish: WishItem): string {
  const kind = wish.type === "minifig" ? (wish.bricklinkId ?? "") : T.set;
  const rest = wish.fromSeries
    ? T.fromSeries(wish.fromSeries)
    : TEXTS.conditions[wish.desiredCondition].toLowerCase();
  return [kind, rest].filter(Boolean).join(" · ");
}

function WishCover({ wish, scribbleId }: { readonly wish: WishItem; readonly scribbleId: string }) {
  return (
    <Cover
      image={wish.imageUrl ? { kind: "catalog", url: wish.imageUrl } : undefined}
      alt=""
      tintKey={wish.id}
      scribbleId={scribbleId}
      variant="thumb"
    />
  );
}

function Prices({ wish, status }: { readonly wish: WishItem; readonly status: WishStatus }) {
  return (
    <span class="wish-row__price">
      <span class="wish-row__amount">
        {status.marketPrice ? formatMoney(status.marketPrice.cents) : "–"}
      </span>
      <span class="tile__meta">
        {wish.targetPrice === undefined
          ? status.marketPrice
            ? ""
            : T.noPrice
          : T.target(formatMoney(wish.targetPrice))}
      </span>
    </span>
  );
}

/** The bin beside an entry; without a connection it is switched off (P15). */
function RemoveButton({
  wish,
  onClick,
}: {
  readonly wish: WishItem;
  readonly onClick: () => void;
}) {
  const writable = useWritable();
  return (
    <button
      type="button"
      class="icon-button wish-remove pressable"
      aria-label={T.remove.button(wish.name)}
      title={writable ? undefined : TEXTS.readOnlyShort}
      disabled={!writable}
      onClick={onClick}
    >
      <Icon name="trash" size={20} />
    </button>
  );
}

/** Asks before a wish is taken off the list; says so if the server refused. */
function RemoveWishSheet({
  wish,
  actions,
  onClose,
}: {
  readonly wish: WishItem;
  readonly actions: WishActions;
  readonly onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const writable = useWritable();
  return (
    <Sheet
      id="remove-wish"
      title={T.remove.title(wish.name)}
      closeLabel={T.remove.close}
      onClose={onClose}
      footer={(close) => (
        <>
          <button type="button" class="button button--secondary pressable" onClick={close}>
            {T.remove.keep}
          </button>
          <button
            type="button"
            class="button button--danger pressable"
            disabled={busy || !writable}
            onClick={async () => {
              setBusy(true);
              setFailed(false);
              try {
                await actions.remove(wish.id);
                close();
              } catch {
                setBusy(false);
                setFailed(true);
              }
            }}
          >
            {busy ? T.remove.removing : T.remove.confirm}
          </button>
        </>
      )}
    >
      <p class="card__text">{T.remove.text}</p>
      {failed && (
        <p class="banner banner--error" role="alert">
          {T.remove.failed}
        </p>
      )}
    </Sheet>
  );
}

/**
 * S9: the wishes with the ones whose target price is reached on top (F14), sorted by priority,
 * price or name; a tap opens the wish sheet (S9a), the bin beside each entry removes it after a
 * question.
 */
export function WishlistPage({
  data,
  remote,
}: {
  readonly data: LoadedCollection;
  readonly remote: Remote | undefined;
}) {
  const [sort, setSort] = useState<WishSort>("priority");
  const [openId, setOpenId] = useState<string | undefined>();
  const [removeId, setRemoveId] = useState<string | undefined>();
  if (data.state.status !== "ready") {
    return (
      <>
        <WishSwitch current="wishes" />
        <Unready data={data} />
      </>
    );
  }
  const { wishlist, prices } = data.state.collection;
  const { reached, others } = arrangeWishlist(wishlist, prices, sort);
  const open = wishlist.find((wish) => wish.id === openId);
  const removing = wishlist.find((wish) => wish.id === removeId);
  const actions = wishActions(remote, data.update);

  return (
    <>
      <WishSwitch current="wishes" />
      {wishlist.length === 0 ? (
        <section class="card" aria-labelledby="no-wishes-title">
          <h2 class="card__title" id="no-wishes-title">
            {T.empty.title}
          </h2>
          <p class="card__text">{T.empty.text}</p>
          <a class="button button--primary pressable" href={seriesHash({ kind: "list" })}>
            <Icon name="search" size={20} />
            {T.empty.action}
          </a>
        </section>
      ) : (
        <>
          {reached.map((wish) => {
            const status = wishStatus(wish, prices);
            return (
              <div key={wish.id} class="wish-item wish-item--reached">
                <button
                  type="button"
                  class="wish-reached pressable"
                  onClick={() => setOpenId(wish.id)}
                >
                  <Scribbles id={`reached-${wish.id}`} />
                  <span class="wish-reached__label">
                    <Icon name="check" size={18} strokeWidth={3} />
                    {T.reached}
                  </span>
                  <span class="wish-reached__row">
                    <WishCover wish={wish} scribbleId={`wish-cover-${wish.id}`} />
                    <span class="wish-row__text">
                      <span class="wish-row__name">{wish.name}</span>
                      <span class="tile__meta">
                        {[
                          subline(wish),
                          wish.targetPrice === undefined
                            ? ""
                            : T.target(formatMoney(wish.targetPrice)),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span class="wish-row__amount">
                      {status.marketPrice ? formatMoney(status.marketPrice.cents) : ""}
                    </span>
                  </span>
                </button>
                <RemoveButton wish={wish} onClick={() => setRemoveId(wish.id)} />
              </div>
            );
          })}
          <div class="list-bar">
            <span class="tile__meta">{T.entries(wishlist.length)}</span>
            <button
              type="button"
              class="list-bar__sort pressable"
              aria-label={`${T.sortLabel}: ${T.sorts[sort]}`}
              onClick={() => setSort(SORTS[(SORTS.indexOf(sort) + 1) % SORTS.length] ?? "priority")}
            >
              {T.sorts[sort]}
            </button>
          </div>
          {others.length > 0 && (
            <ul class="wish-list">
              {others.map((wish) => (
                <li key={wish.id} class="wish-item">
                  <button
                    type="button"
                    class="wish-row pressable"
                    onClick={() => setOpenId(wish.id)}
                  >
                    <WishCover wish={wish} scribbleId={`wish-cover-${wish.id}`} />
                    <span class="wish-row__text">
                      <span class="wish-row__name">{wish.name}</span>
                      <span class="tile__meta">{subline(wish)}</span>
                      <span class={`pill pill--${wish.priority}`}>
                        {T.priorities[wish.priority]}
                      </span>
                    </span>
                    <Prices wish={wish} status={wishStatus(wish, prices)} />
                  </button>
                  <RemoveButton wish={wish} onClick={() => setRemoveId(wish.id)} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {open && (
        <WishSheet
          source={{
            type: open.type,
            name: open.name,
            number: open.type === "minifig" ? open.bricklinkId : open.setNumber,
            theme: open.theme,
            imageUrl: open.imageUrl,
          }}
          initial={wishValuesOf(open)}
          existing={open}
          prices={prices}
          actions={actions}
          onClose={() => setOpenId(undefined)}
          onReceived={() => {
            location.hash = formHash({ type: open.type, mode: "wish", id: open.id });
          }}
        />
      )}
      {removing && (
        <RemoveWishSheet
          key={removing.id}
          wish={removing}
          actions={actions}
          onClose={() => setRemoveId(undefined)}
        />
      )}
    </>
  );
}
