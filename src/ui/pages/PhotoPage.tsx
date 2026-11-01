import { useEffect, useRef, useState } from "preact/hooks";
import { CatalogCallError } from "../../backend/catalog";
import type { Recognizer, Suggestion } from "../../backend/recognition";
import { formatScore } from "../../domain/recognition";
import { PhotoError, resizePhoto } from "../../files/browserPhoto";
import { CapturePhoto } from "../capturePhoto";
import { Cover } from "../components/Cover";
import { Icon } from "../components/Icon";
import { formHash, routeHash, searchHash } from "../route";
import { TEXTS } from "../texts";

const T = TEXTS.recognition;

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
 * S7a: a photo of a figure in (camera on the phone, file on the PC), up to five suggestions out.
 * A suggestion opens the form filled from the catalog (F1, F2); the photo stays with it. The photo
 * is made small first (`resizePhoto`) and goes to the function `recognize`, never to Brickognize
 * directly.
 */
export function PhotoPage({ recognizer }: { readonly recognizer: Recognizer | undefined }) {
  const [file, setFile] = useState<File | undefined>(() => CapturePhoto.peek());
  const [state, setState] = useState<RecognitionState>({ status: "empty" });
  const [attempt, setAttempt] = useState(0);
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
        );
        if (active) setState({ status: "done", suggestions });
      } catch (error) {
        if (active) setState({ status: "failed", ...failureMessage(error) });
      }
    })();
    return () => {
      active = false;
    };
  }, [file, recognizer, attempt]);

  const choose = (files: FileList | null) => {
    const chosen = files?.[0];
    if (input.current) input.current.value = "";
    if (!chosen) return;
    CapturePhoto.hold(chosen);
    setFile(chosen);
  };

  const working = state.status === "working";
  const best = state.status === "done" ? state.suggestions[0] : undefined;

  return (
    <>
      <header class="page-header">
        <a class="icon-button back-link pressable" href={routeHash("capture")} aria-label={T.back}>
          <Icon name="back" />
        </a>
        <h1 class="page-title page-title--small" tabIndex={-1}>
          {T.title}
        </h1>
        <span class="header-spacer" />
      </header>

      <div class="photo-preview">
        {previewUrl ? (
          <>
            <img class="photo-preview__image" src={previewUrl} alt={T.photoAlt} />
            <span class="photo-preview__tag">{T.yourPhoto}</span>
          </>
        ) : (
          <span class="photo-preview__symbol">
            <Icon name="camera" size={40} strokeWidth={1.6} />
          </span>
        )}
      </div>

      {state.status === "empty" && <p class="card__text">{T.empty}</p>}

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
          <h2 class="card__title card__title--small">{T.none.title}</h2>
          <p class="card__text">{T.none.text}</p>
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
            {state.suggestions.map((suggestion) => (
              <li key={suggestion.number}>
                <a
                  class={`suggestion pressable${suggestion === best ? " suggestion--best" : ""}`}
                  href={formHash({ type: "minifig", mode: "catalog", ref: suggestion.number })}
                >
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
                    <span class="search-hit__facts">{suggestion.number}</span>
                  </span>
                  <span class="suggestion__score">{formatScore(suggestion.score)}</span>
                  <span class="visually-hidden">
                    {T.choose(suggestion.name, formatScore(suggestion.score))}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}

      {(state.status === "done" || state.status === "failed") && (
        <a class="button button--secondary button--flat pressable" href={searchHash("minifig")}>
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
    </>
  );
}
