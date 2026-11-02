import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { Catalog } from "../../backend/catalog";
import {
  type LinkAnswer,
  LinkCallError,
  type LinkPreviewer,
  type PageFields,
} from "../../backend/linkPreview";
import type { Remote } from "../../backend/remote";
import { webAddress } from "../../domain/forms";
import { catalogTarget, hasFields, linkRows, numberOfRef } from "../../domain/linkForm";
import { CaptureLink } from "../captureLink";
import { Cover } from "../components/Cover";
import { fieldId } from "../components/Fields";
import { Icon } from "../components/Icon";
import { type WishPick, WishPicker } from "../components/WishPicker";
import { type DetailType, formHash, linkHash, routeHash } from "../route";
import { TEXTS } from "../texts";
import type { LoadedCollection } from "../useCollection";

/** A wish is a figure or a set; a special part counts as a set here (never offered for wishes). */
function wishType(type: DetailType): "minifig" | "legoSet" {
  return type === "minifig" ? "minifig" : "legoSet";
}

const T = TEXTS.linkCapture;

/** The wait after the last key before the page is read, so typing or pasting sends one call. */
const PAUSE_MS = 400;

type LinkState =
  | { readonly status: "idle" }
  | { readonly status: "invalid" }
  | { readonly status: "reading" }
  | { readonly status: "done"; readonly address: string; readonly answer: LinkAnswer }
  | {
      readonly status: "failed";
      readonly address: string;
      readonly message: string;
      /** Whether trying again can help; a refused address or sign-in cannot be fixed by waiting. */
      readonly again: boolean;
      /** Whether the form may open with the link alone. */
      readonly save: boolean;
    };

function failureOf(error: unknown): { message: string; again: boolean; save: boolean } {
  const failure = error instanceof LinkCallError ? error.failure : "unavailable";
  if (failure === "blocked") return { message: T.failed.blocked, again: false, save: true };
  if (failure === "not_signed_in") {
    return { message: T.failed.not_signed_in, again: false, save: false };
  }
  if (failure === "offline") return { message: T.failed.offline, again: true, save: true };
  if (failure === "unreachable") return { message: T.failed.unreachable, again: true, save: true };
  return { message: T.failed.unavailable, again: true, save: true };
}

function Source({ label }: { readonly label: string }) {
  return <span class="pill pill--mint">{label}</span>;
}

/**
 * S7c: a pasted link in, as much as possible filled in out (F3). Rebrickable and BrickLink addresses
 * go to the catalog (the number is in the address), a Merlins Steine page and any other page are
 * read once by the function `link-preview`. Whatever cannot be read, the form still opens with the
 * link saved and the rest empty.
 */
export function LinkPage({
  type: initialType,
  previewer,
  forWish = false,
  data,
  remote,
  catalog,
}: {
  readonly type: DetailType;
  readonly previewer: LinkPreviewer | undefined;
  /** A wish instead of an object (P15): "Weiter" opens the wish sheet. */
  readonly forWish?: boolean;
  readonly data?: LoadedCollection | undefined;
  readonly remote?: Remote | undefined;
  readonly catalog?: Catalog | undefined;
}) {
  const [type, setType] = useState(initialType);
  const [text, setText] = useState("");
  const [state, setState] = useState<LinkState>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);
  const [pasteFailed, setPasteFailed] = useState(false);
  const [pick, setPick] = useState<WishPick | undefined>();

  /** "Weiter": the form (an object) or the wish sheet (a wish, P15). */
  const lead = (href: string, wish: WishPick, label: string, primary: boolean) => {
    const className = `button ${primary ? "button--primary" : "button--secondary"} button--flat pressable`;
    return forWish ? (
      <button type="button" class={className} onClick={() => setPick(wish)}>
        {label}
      </button>
    ) : (
      <a class={className} href={href}>
        {label}
      </a>
    );
  };

  const chooseType = (next: "minifig" | "legoSet") => {
    setType(next);
    setPick(undefined);
    history.replaceState(null, "", linkHash(next, true));
  };

  useEffect(() => {
    const trimmed = text.trim();
    if (trimmed === "") {
      setState({ status: "idle" });
      return;
    }
    const address = webAddress(trimmed);
    // The old result must not stay while another address is typed or read.
    setState(address === undefined ? { status: "idle" } : { status: "reading" });
    let active = true;
    const timer = setTimeout(
      () => {
        if (address === undefined) {
          setState({ status: "invalid" });
          return;
        }
        const read = previewer
          ? previewer.preview(address)
          : Promise.reject(new LinkCallError("Keine Link-Vorschau", "unavailable"));
        read.then(
          (answer) => {
            if (!active) return;
            CaptureLink.hold(address, answer);
            setState({ status: "done", address, answer });
          },
          (error: unknown) =>
            active && setState({ status: "failed", address, ...failureOf(error) }),
        );
      },
      // A valid address is read at once after a short pause; a half-typed one is judged later.
      address === undefined ? PAUSE_MS * 2 : PAUSE_MS,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [previewer, text, attempt]);

  const paste = async () => {
    setPasteFailed(false);
    try {
      const clipboard = await navigator.clipboard.readText();
      setText(clipboard.trim());
    } catch {
      setPasteFailed(true);
    }
  };

  const withoutPreview = (address: string) =>
    lead(
      formHash({ type, mode: "link", link: address }),
      { kind: "page", type: wishType(type), fields: {}, link: address },
      forWish ? TEXTS.wishCapture.next : T.withoutPreview,
      false,
    );

  return (
    <>
      <header class="page-header">
        <a class="icon-button back-link pressable" href={routeHash("capture")} aria-label={T.back}>
          <Icon name="back" />
        </a>
        <h1 class="page-title page-title--small" tabIndex={-1}>
          {forWish ? TEXTS.wishCapture.linkTitle : T.title}
        </h1>
        <span class="header-spacer" />
      </header>

      {forWish && (
        <fieldset class="choice">
          <legend class="visually-hidden">{TEXTS.wishCapture.kindsLabel}</legend>
          <div class="chips">
            {(["minifig", "legoSet"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                class="chip pressable"
                aria-pressed={type === kind}
                onClick={() => chooseType(kind)}
              >
                {TEXTS.search.kinds[kind]}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div class="field">
        <label class="field__label" for={fieldId("link", "address")}>
          {T.label}
        </label>
        <input
          id={fieldId("link", "address")}
          class="field__input"
          type="text"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellcheck={false}
          placeholder={T.placeholder}
          value={text}
          aria-invalid={state.status === "invalid" ? true : undefined}
          aria-describedby="link-status"
          onInput={(event) => setText(event.currentTarget.value)}
        />
      </div>
      <button type="button" class="button button--secondary pressable" onClick={() => void paste()}>
        <Icon name="paste" size={20} />
        {T.paste}
      </button>

      <div id="link-status" role="status" aria-live="polite">
        {pasteFailed && <p class="card__text">{T.pasteFailed}</p>}
        {state.status === "idle" && <p class="card__text">{T.idle}</p>}
        {state.status === "invalid" && <p class="field__error">{T.notAnAddress}</p>}
        {state.status === "reading" && (
          <p class="search-results__status" aria-busy="true">
            {T.reading}
          </p>
        )}
      </div>

      {state.status === "failed" && (
        <section class="card" role="alert">
          <h2 class="card__title card__title--small">{T.failed.title}</h2>
          <p class="card__text">{state.message}</p>
          {state.again && (
            <button
              type="button"
              class="button button--secondary pressable"
              onClick={() => setAttempt((count) => count + 1)}
            >
              {T.retry}
            </button>
          )}
          {state.save && withoutPreview(state.address)}
        </section>
      )}

      {state.status === "done" && state.answer.kind === "catalog" && (
        <CatalogResult
          answer={state.answer}
          address={state.address}
          type={type}
          forWish={forWish}
          lead={lead}
        />
      )}

      {state.status === "done" && state.answer.kind === "page" && (
        <PageResult
          type={type}
          address={state.address}
          answer={state.answer}
          previewer={forWish ? undefined : previewer}
          next={lead(
            formHash({ type, mode: "link", link: state.address }),
            {
              kind: "page",
              type: wishType(type),
              fields: state.answer.fields,
              link: state.address,
            },
            forWish ? TEXTS.wishCapture.next : T.next,
            true,
          )}
        />
      )}

      {forWish && pick && data && (
        <WishPicker
          key={pick.kind === "catalog" ? `${pick.catalogKind}-${pick.ref}` : pick.link}
          pick={pick}
          data={data}
          remote={remote}
          catalog={catalog}
          onClose={() => setPick(undefined)}
        />
      )}
    </>
  );
}

/**
 * The card "Erkannt" of a Rebrickable, BrickLink or LEGO.com address: what kind of entry it is and
 * its number; the catalog fills the rest in the form. A special part cannot become a wish.
 */
function CatalogResult({
  answer,
  address,
  type,
  forWish,
  lead,
}: {
  readonly answer: Extract<LinkAnswer, { kind: "catalog" }>;
  readonly address: string;
  readonly type: DetailType;
  readonly forWish: boolean;
  readonly lead: (
    href: string,
    wish: WishPick,
    label: string,
    primary: boolean,
  ) => ComponentChildren;
}) {
  const target = catalogTarget(answer, type, forWish);
  const { catalogKind, ref } = target;
  return (
    <>
      <section class="card" aria-labelledby="link-recognized">
        <div class="card__head">
          <h2 class="card__title" id="link-recognized">
            {T.recognized}
          </h2>
          <Source label={T.sources[answer.source]} />
        </div>
        <dl class="rows">
          <div class="rows__row">
            <dt class="rows__label">{T.rows.kind}</dt>
            <dd class="rows__value">{T.kinds[catalogKind]}</dd>
          </div>
          <div class="rows__row">
            <dt class="rows__label">{T.rows.catalogNumber}</dt>
            <dd class="rows__value">{numberOfRef(ref)}</dd>
          </div>
        </dl>
        <p class="card__text">
          {forWish && catalogKind === "specialPart" ? T.noWishForParts : T.catalogNote}
        </p>
      </section>
      {catalogKind === "specialPart" && forWish
        ? null
        : lead(
            formHash({ type: catalogKind, mode: "catalog", ref, link: address }),
            catalogKind === "specialPart"
              ? { kind: "page", type: "legoSet", fields: {}, link: address }
              : { kind: "catalog", catalogKind, ref, link: address },
            forWish ? TEXTS.wishCapture.next : T.next,
            true,
          )}
    </>
  );
}

/** The card "Erkannt" of a page, or the note that nothing could be read; both lead on. */
function PageResult({
  type,
  address,
  answer,
  previewer,
  next,
}: {
  readonly type: DetailType;
  readonly address: string;
  readonly answer: Extract<LinkAnswer, { kind: "page" }>;
  /** Fetches the page's picture; none for a wish, which keeps only the picture's address. */
  readonly previewer: LinkPreviewer | undefined;
  readonly next: ComponentChildren;
}) {
  if (!hasFields(answer.fields)) {
    return (
      <>
        <section class="card" role="status">
          <h2 class="card__title card__title--small">{T.nothingFound.title}</h2>
          <p class="card__text">{T.nothingFound.text}</p>
        </section>
        {next}
      </>
    );
  }
  const { fields } = answer;
  return (
    <PageCard
      key={address}
      type={type}
      address={address}
      answer={answer}
      fields={fields}
      previewer={previewer}
      next={next}
    />
  );
}

type FetchedImage =
  | { readonly status: "none" }
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly url: string }
  | { readonly status: "failed" };

/**
 * The page's picture, fetched by the function (a page that forbids embedding still gives it). The
 * file is kept for the form that follows; the address shown here is only for the card.
 */
function useFetchedImage(
  previewer: LinkPreviewer | undefined,
  imageUrl: string | undefined,
): FetchedImage {
  const [picture, setPicture] = useState<FetchedImage>({ status: "none" });
  useEffect(() => {
    if (!imageUrl || !previewer) {
      setPicture({ status: "none" });
      return;
    }
    let active = true;
    let shown: string | undefined;
    setPicture({ status: "loading" });
    previewer.image(imageUrl).then(
      (file) => {
        if (!active) return;
        CaptureLink.holdImage(imageUrl, file);
        shown = URL.createObjectURL(file);
        setPicture({ status: "ready", url: shown });
      },
      () => active && setPicture({ status: "failed" }),
    );
    return () => {
      active = false;
      if (shown) URL.revokeObjectURL(shown);
    };
  }, [previewer, imageUrl]);
  return picture;
}

/** The card itself; its own component so the "picture failed" note starts over for each address. */
function PageCard({
  type,
  address,
  answer,
  fields,
  previewer,
  next,
}: {
  readonly type: DetailType;
  readonly address: string;
  readonly answer: Extract<LinkAnswer, { kind: "page" }>;
  readonly fields: PageFields;
  readonly previewer: LinkPreviewer | undefined;
  readonly next: ComponentChildren;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const picture = useFetchedImage(previewer, fields.imageUrl);
  return (
    <>
      <section class="card" aria-labelledby="link-recognized">
        <div class="card__head">
          <h2 class="card__title" id="link-recognized">
            {T.recognized}
          </h2>
          <Source label={T.sources[answer.source]} />
        </div>
        <Cover
          image={
            picture.status === "ready"
              ? { kind: "catalog", url: picture.url }
              : fields.imageUrl
                ? { kind: "catalog", url: fields.imageUrl }
                : undefined
          }
          alt={fields.imageUrl ? T.imageAlt : ""}
          tintKey={address}
          scribbleId="link-preview"
          variant="banner"
          onBroken={() => setImageFailed(true)}
        />
        <dl class="rows">
          {linkRows(type, fields).map((row) => (
            <div key={row.key} class="rows__row">
              <dt class="rows__label">
                {row.key === "number" ? T.rows.number[type] : T.rows[row.key]}
              </dt>
              <dd class="rows__value">
                {row.value === undefined ? (
                  <span class="pill pill--pop">{T.pleaseAdd}</span>
                ) : row.key === "image" ? (
                  picture.status === "loading" ? (
                    T.imageLoading
                  ) : picture.status === "ready" ? (
                    T.imageTaken
                  ) : imageFailed ? (
                    T.imageBlocked
                  ) : (
                    T.imageTaken
                  )
                ) : (
                  row.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      {next}
    </>
  );
}
