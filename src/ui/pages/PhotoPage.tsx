import { useEffect, useRef, useState } from "preact/hooks";
import type { Catalog } from "../../backend/catalog";
import { CatalogCallError } from "../../backend/catalog";
import type { Recognizer, Suggestion } from "../../backend/recognition";
import type { Remote } from "../../backend/remote";
import { formatScore } from "../../domain/recognition";
import { PhotoError, resizePhoto } from "../../files/browserPhoto";
import { CapturePhoto } from "../capturePhoto";
import { Cover } from "../components/Cover";
import { Icon } from "../components/Icon";
import { type WishPick, WishPicker } from "../components/WishPicker";
import { type DetailType, formHash, photoHash, routeHash, searchHash } from "../route";
import { TEXTS } from "../texts";
import type { LoadedCollection } from "../useCollection";

const T = TEXTS.recognition;

/** A wish is a figure or a set. */
const WISH_KINDS: readonly DetailType[] = ["minifig", "legoSet"];

type RecognitionState =
  | { readonly status: "empty" }
  | { readonly status: "working"; readonly step: "resizing" | "recognizing" }
  | { readonly status: "done"; readonly suggestions: readonly Suggestion[] }
  | { readonly status: "failed"; readonly message: string; readonly again: boolean };

function failureMessage(error: unknown): { message: string; again: boolean } {
  if (error instanceof PhotoError) return { message: T.failed.unreadable, again: false };
  const failure = error instanceof CatalogCallError ? error.failure : "unavailable";
  if (failure === "offline") return { message: T.failed.offline, again: true };
  if (failure === "limit_reached") return { message: T.failed.limit_reached, again: true };
  if (failure === "not_signed_in") return { message: T.failed.not_signed_in, again: false };
  return { message: T.failed.unavailable, again: true };
}

/** The address of the photo as long as the file is shown; given back when another one comes. */
function usePreviewUrl(file: File | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>();
  useEffect(() => {
    if (!file) {
      setUrl(undefined);
      return;
    }
    const made = URL.createObjectURL(file);
    setUrl(made);
    return () => URL.revokeObjectURL(made);
  }, [file]);
  return url;
}

/**
 * S7a: a photo of a figure, a set or a special part in (camera on the phone, file on the PC), up to
 * five suggestions out. A suggestion opens the form filled from the catalog (F1, F2); the photo
 * stays with it. For a wish (`forWish`) a suggestion opens the wish sheet instead, and the person
 * chooses between figure and set here. The photo is made small first (`resizePhoto`) and goes to
 * the function `recognize`, never to Brickognize directly.
 */
export function PhotoPage({
  type: initialType,
  recognizer,
  forWish = false,
  data,
  remote,
  catalog,
}: {
  readonly type: DetailType;
  readonly recognizer: Recognizer | undefined;
  readonly forWish?: boolean;
  /** The collection the wish goes into (only for a wish). */
  readonly data?: LoadedCollection | undefined;
  readonly remote?: Remote | undefined;
  readonly catalog?: Catalog | undefined;
}) {
  const [type, setType] = useState(initialType);
  const [file, setFile] = useState<File | undefined>(() => CapturePhoto.peek());
  const [state, setState] = useState<RecognitionState>({ status: "empty" });
  const [attempt, setAttempt] = useState(0);
  const [pick, setPick] = useState<Extract<WishPick, { kind: "catalog" }> | undefined>();
  const input = useRef<HTMLInputElement>(null);
  const previewUrl = usePreviewUrl(file);

  useEffect(() => {
    if (!file) {
      setState({ status: "empty" });
      return;
    }
    let active = true;
    setState({ status: "working", step: "resizing" });
    void (async () => {
      try {
        const small = await resizePhoto(file);
        if (!active) return;
        setState({ status: "working", step: "recognizing" });
        if (!recognizer) throw new CatalogCallError("Keine Erkennung", "unavailable");
        const suggestions = await recognizer.recognize(
          new Blob([small.bytes as Uint8Array<ArrayBuffer>], { type: small.contentType }),
          type,
        );
        if (active) setState({ status: "done", suggestions });
      } catch (error) {
        if (active) setState({ status: "failed", ...failureMessage(error) });
      }
    })();
    return () => {
      active = false;
    };
  }, [file, recognizer, attempt, type]);

  const choose = (files: FileList | null) => {
    const chosen = files?.[0];
    if (input.current) input.current.value = "";
    if (!chosen) return;
    CapturePhoto.hold(chosen);
    setFile(chosen);
  };

  const chooseKind = (next: DetailType) => {
    setType(next);
    // The address follows the chip; the router is not told, the page stays.
    history.replaceState(null, "", photoHash(next, forWish));
  };

  const working = state.status === "working";
  const best = state.status === "done" ? state.suggestions[0] : undefined;
  const none = T.none[type];

  return (
    <>
      <header class="page-header">
        <a class="icon-button back-link pressable" href={routeHash("capture")} aria-label={T.back}>
          <Icon name="back" />
        </a>
        <h1 class="page-title page-title--small" tabIndex={-1}>
          {forWish ? T.titleWish : T.title}
        </h1>
        <span class="header-spacer" />
      </header>

      {forWish && (
        <fieldset class="choice">
          <legend class="visually-hidden">{T.kindsLabel}</legend>
          <div class="chips">
            {WISH_KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                class="chip pressable"
                aria-pressed={type === kind}
                onClick={() => chooseKind(kind)}
              >
                {T.kinds[kind as "minifig" | "legoSet"]}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div class="photo-preview">
        {previewUrl ? (
          <>
            <img class="photo-preview__image" src={previewUrl} alt={T.photoAlt[type]} />
            <span class="photo-preview__tag">{T.yourPhoto}</span>
          </>
        ) : (
          <span class="photo-preview__symbol">
            <Icon name="camera" size={40} strokeWidth={1.6} />
          </span>
        )}
      </div>

      {type === "specialPart" && <p class="card__text">{T.attempt}</p>}

      {state.status === "empty" && <p class="card__text">{T.empty[type]}</p>}

      {working && (
        <p class="search-results__status" role="status" aria-busy="true">
          {state.step === "resizing" ? T.resizing : T.recognizing}
        </p>
      )}

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
        </section>
      )}

      {state.status === "done" && state.suggestions.length === 0 && (
        <section class="card" role="status">
          <h2 class="card__title card__title--small">{none.title}</h2>
          <p class="card__text">{none.text}</p>
        </section>
      )}

      {state.status === "done" && state.suggestions.length > 0 && (
        <>
          <div class="suggestions-head">
            <h2 class="card__title">{T.suggestions(state.suggestions.length)}</h2>
            <span class="visually-hidden" role="status">
              {T.suggestions(state.suggestions.length)}
            </span>
            <span class="suggestions-head__label">{T.scoreLabel}</span>
          </div>
          <ul class="suggestions">
            {state.suggestions.map((suggestion) => {
              const ref = suggestion.ref ?? suggestion.number;
              const className = `suggestion pressable${suggestion === best ? " suggestion--best" : ""}`;
              const body = (
                <>
                  <Cover
                    image={
                      suggestion.imageUrl
                        ? { kind: "catalog", url: suggestion.imageUrl }
                        : undefined
                    }
                    alt=""
                    tintKey={suggestion.number}
                    scribbleId={`suggestion-${suggestion.number}`}
                    variant="small"
                  />
                  <span class="search-hit__text">
                    <span class="search-hit__name">{suggestion.name}</span>
                    <span class="search-hit__facts">
                      {suggestion.bricklinkType === "PART"
                        ? `${suggestion.number} · ${T.bigFig}`
                        : suggestion.number}
                    </span>
                  </span>
                  <span class="suggestion__score">{formatScore(suggestion.score)}</span>
                  <span class="visually-hidden">
                    {forWish
                      ? TEXTS.wishCapture.pick(suggestion.name)
                      : T.choose(suggestion.name, formatScore(suggestion.score))}
                  </span>
                </>
              );
              return (
                <li key={suggestion.number}>
                  {forWish && type !== "specialPart" ? (
                    <button
                      type="button"
                      class={className}
                      onClick={() => setPick({ kind: "catalog", catalogKind: type, ref })}
                    >
                      {body}
                    </button>
                  ) : (
                    <a class={className} href={formHash({ type, mode: "catalog", ref })}>
                      {body}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {(state.status === "done" || state.status === "failed") && (
        <a class="button button--secondary button--flat pressable" href={searchHash(type, forWish)}>
          <Icon name="number" size={20} />
          {state.status === "failed" ? T.byNumber : T.notFitting}
        </a>
      )}

      <button
        type="button"
        class="button button--secondary pressable"
        disabled={working}
        onClick={() => input.current?.click()}
      >
        <Icon name="camera" size={20} />
        {file ? T.again : T.pick}
      </button>
      {/* Opened by the button; a phone offers the camera and the gallery for "image/*". */}
      <input
        ref={input}
        hidden
        type="file"
        accept="image/*"
        onChange={(event) => choose(event.currentTarget.files)}
      />

      {forWish && pick && data && (
        <WishPicker
          key={`${pick.catalogKind}-${pick.ref}`}
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
