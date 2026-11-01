import { useEffect, useRef, useState } from "preact/hooks";
import { type Catalog, CatalogCallError } from "../../backend/catalog";
import type { LinkPreviewer, PageFields } from "../../backend/linkPreview";
import { type Remote, RemoteError, saveItem } from "../../backend/remote";
import { type CatalogForm, formFromCatalog } from "../../domain/catalog";
import { withoutObject, withSavedItem } from "../../domain/collectionEdit";
import { findItem } from "../../domain/details";
import {
  buildItem,
  emptyForm,
  type FieldError,
  type FieldKey,
  type FormErrors,
  type FormValues,
  fieldsOf,
  firstError,
  formForCopy,
  formFromItem,
  validateForm,
} from "../../domain/forms";
import { formFromLink, hasFields } from "../../domain/linkForm";
import { formatMoney } from "../../domain/money";
import { shortSetNumber } from "../../domain/showcase";
import type {
  Collection,
  ManufacturerKind,
  ModPart,
  ShowcaseItem,
  WishItem,
} from "../../domain/types";
import { modSpend } from "../../domain/value";
import { formFromWish, withCatalogEntry } from "../../domain/wishForm";
import { resizePhoto } from "../../files/browserPhoto";
import { uploadFile } from "../../files/upload";
import { CaptureLink } from "../captureLink";
import { CapturePhoto } from "../capturePhoto";
import { Choice, FormCard, fieldId, TextField } from "../components/Fields";
import { Icon } from "../components/Icon";
import { ModSheet } from "../components/ModSheet";
import { PhotoField, photoFileName } from "../components/PhotoField";
import { ReadOnlyNote } from "../components/WriteLink";
import { newId, today } from "../ids";
import {
  detailHash,
  type FormRef,
  formHash,
  linkHash,
  photoHash,
  routeHash,
  searchHash,
} from "../route";
import { TEXTS } from "../texts";
import { type LoadedCollection, useWritable } from "../useCollection";

const T = TEXTS.form;
const CT = TEXTS.catalogForm;
const PREFIX = "field";

const MANUFACTURERS: readonly ManufacturerKind[] = ["lego", "bluebrixx", "other", "custom"];

/** After the form has drawn its error messages (WebKit sometimes drops a focus set before). */
function focusField(field: FieldKey): void {
  requestAnimationFrame(() => document.getElementById(fieldId(PREFIX, field))?.focus());
}

/** What the person sees when saving failed: a refusal says why, anything else is "try again". */
function saveFailure(error: unknown): string {
  if (error instanceof RemoteError && error.permanent) {
    if (error.reason === "too_many_photos") return T.saveFailed.too_many_photos;
    if (error.reason === "too_large") return T.saveFailed.too_large;
    return T.saveFailed.refused;
  }
  return navigator.onLine ? T.saveFailed.server : T.saveFailed.offline;
}

/** The form to start from and the object being changed, or `undefined` if there is none to find. */
function startOf(
  form: FormRef,
  collection: Collection,
): { values: FormValues; existing: ShowcaseItem | undefined } | undefined {
  // A catalog form starts from the entry, which `CatalogFormLoader` fetches first.
  if (form.mode === "new" || form.mode === "catalog" || form.mode === "link") {
    return { values: emptyForm(), existing: undefined };
  }
  // A form from a wish starts from the wish (`FormPage` handles it).
  if (form.mode === "wish") return undefined;
  const item = findItem(collection, form.type, form.id);
  if (!item) return undefined;
  if (form.mode === "copy") {
    return item.type === "minifig"
      ? { values: formForCopy(item, collection.sets), existing: undefined }
      : undefined;
  }
  return { values: formFromItem(item, collection.sets), existing: item };
}

/** The picture of the page a form was started from: being fetched, in hand, or not to be had. */
type LinkImage =
  | { readonly status: "none" }
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly file: File }
  | { readonly status: "failed" };

/** "www.merlinssteine.de" → "merlinssteine.de": what the notice calls the page. */
function hostOf(address: string): string {
  try {
    return new URL(address).hostname.replace(/^www\./, "");
  } catch {
    return address;
  }
}

/**
 * The picture of a page, fetched by the function `link-preview` (the one held from the link page,
 * else asked for once more): a page that forbids embedding still gives it.
 */
function useLinkImage(
  previewer: LinkPreviewer | undefined,
  imageUrl: string | undefined,
): LinkImage {
  const [image, setImage] = useState<LinkImage>(() => {
    if (!imageUrl) return { status: "none" };
    const held = CaptureLink.peekImage(imageUrl);
    return held ? { status: "ready", file: held } : { status: "loading" };
  });
  useEffect(() => {
    if (!imageUrl) {
      setImage({ status: "none" });
      return;
    }
    const held = CaptureLink.peekImage(imageUrl);
    if (held) {
      setImage({ status: "ready", file: held });
      return;
    }
    let active = true;
    setImage({ status: "loading" });
    const fetched = previewer
      ? previewer.image(imageUrl)
      : Promise.reject(new Error("Keine Link-Vorschau"));
    fetched.then(
      (file) => {
        if (!active) return;
        CaptureLink.holdImage(imageUrl, file);
        setImage({ status: "ready", file });
      },
      () => active && setImage({ status: "failed" }),
    );
    return () => {
      active = false;
    };
  }, [previewer, imageUrl]);
  return image;
}

interface FormBodyProps {
  readonly form: FormRef;
  readonly collection: Collection;
  readonly start: { values: FormValues; existing: ShowcaseItem | undefined };
  readonly remote: Remote | undefined;
  readonly update: LoadedCollection["update"];
  /** The picture of the page the form was started from; it becomes the first own photo on saving. */
  readonly linkImage?: LinkImage | undefined;
  /** Whose picture it is, for the notice ("merlinssteine.de"). */
  readonly imageSource?: string | undefined;
  /** The catalog entry the form starts from (F2). */
  readonly catalogForm?: CatalogForm | undefined;
  /** A hint above the form, e.g. that a pasted link could not be read. */
  readonly notice?: string | undefined;
  /** The wish this form fulfils (F14): saving the object takes it off the wishlist. */
  readonly fromWish?: WishItem | undefined;
}

/** Where "Abbrechen" leads: back to the object, to the search, or to the showcase. */
function cancelHash(form: FormRef): string {
  // With a photo taken for the recognition the person comes back to its suggestions.
  if (CapturePhoto.peek() && form.mode === "catalog" && form.type === "minifig") return photoHash();
  if (form.mode === "new") return routeHash("showcase");
  if (form.mode === "wish") return routeHash("wishlist");
  // A form reached from a pasted link goes back to where the link was pasted.
  if (form.mode === "link" || (form.mode === "catalog" && form.link)) return linkHash(form.type);
  if (form.mode === "catalog") return searchHash(form.type);
  return detailHash({ type: form.type, id: form.id });
}

function FormBody({
  form,
  collection,
  start,
  remote,
  update,
  catalogForm,
  notice,
  linkImage,
  imageSource,
  fromWish,
}: FormBodyProps) {
  const { type } = form;
  // The person may decline the page's picture; where it was sent already, a retry reuses it.
  const [takeImage, setTakeImage] = useState(true);
  const imagePath = useRef<string | undefined>(undefined);
  const [values, setValues] = useState<FormValues>(start.values);
  const [errors, setErrors] = useState<FormErrors>({});
  const [failure, setFailure] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  // Without a connection (P15) the form stays as typed, only saving waits.
  const writable = useWritable();
  const [modSheet, setModSheet] = useState<{ part?: ModPart } | null>(null);
  const [summary, setSummary] = useState(0);
  // The id is made once; editing keeps the one the object has.
  const id = useRef(start.existing?.id ?? newId(type)).current;
  const unsaved = useRef(new Set<string>()).current;
  // The photo taken for the recognition (S7a) goes with a new figure, however the form was reached.
  const initialPhoto = useRef(
    type === "minifig" && (form.mode === "new" || form.mode === "catalog")
      ? CapturePhoto.peek()
      : undefined,
  ).current;

  // Photos sent for a form that is left without saving are taken out of storage again.
  useEffect(
    () => () => {
      for (const path of unsaved) void remote?.removeFile("photos", path).catch(() => {});
    },
    [remote, unsaved],
  );

  const set = (fields: Partial<FormValues>) => setValues((current) => ({ ...current, ...fields }));
  const shown = fieldsOf(type);
  const message = (field: FieldKey): string | undefined => {
    const error: FieldError | undefined = errors[field];
    return error ? T.errors[error] : undefined;
  };
  const text = (
    field: FieldKey & keyof FormValues,
    label: string,
    extra: {
      placeholder?: string;
      inputMode?: "decimal" | "numeric" | "url";
      hint?: string | undefined;
      rows?: number;
    } = {},
  ) => (
    <TextField
      id={fieldId(PREFIX, field)}
      label={label}
      value={values[field] as string}
      onInput={(value) => set({ [field]: value })}
      error={message(field)}
      // Green as long as the value is the one the catalog gave.
      prefilled={
        catalogForm?.prefilled.includes(field) && values[field] === start.values[field]
          ? catalogForm.origin === "link"
            ? CT.linkPrefilledNote
            : catalogForm.origin === "wish"
              ? CT.wishPrefilledNote
              : CT.prefilledNote
          : undefined
      }
      {...extra}
    />
  );

  const submit = async (event: Event) => {
    event.preventDefault();
    if (saving) return;
    const found = validateForm(type, values);
    setErrors(found);
    const first = firstError(type, found);
    if (first) {
      setSummary(Object.keys(found).length);
      setFailure(undefined);
      focusField(first);
      return;
    }
    setSummary(0);
    if (!remote) {
      setFailure(T.saveFailed.server);
      return;
    }
    if (linkImage?.status === "loading" && takeImage) {
      setFailure(CT.imageWait);
      return;
    }
    setSaving(true);
    setFailure(undefined);
    // The page's picture becomes the first own photo (made small first, like a chosen one).
    let photos = values.photos;
    let extras = catalogForm?.extras;
    if (linkImage?.status === "ready" && takeImage) {
      try {
        if (imagePath.current === undefined) {
          const small = await resizePhoto(linkImage.file);
          imagePath.current = await uploadFile(
            remote,
            "photos",
            photoFileName(id, small.contentType),
            small.bytes,
            small.contentType,
          );
          unsaved.add(imagePath.current);
        }
      } catch {
        setSaving(false);
        setFailure(CT.imageSaveFailed);
        return;
      }
      const taken = imagePath.current;
      photos = [taken, ...values.photos.filter((path) => path !== taken)];
      // The picture is an own photo now; the page's address is not kept as a second one.
      if (extras) {
        const { imageUrl: _address, ...rest } = extras;
        extras = rest;
      }
    }
    const item = buildItem(
      type,
      { ...values, photos },
      {
        id,
        createdAt: new Date().toISOString(),
        today: today(),
        sets: collection.sets,
        existing: start.existing,
        catalog: extras,
      },
    );
    try {
      await saveItem(remote, item);
    } catch (error) {
      setSaving(false);
      setFailure(saveFailure(error));
      return;
    }
    // What the server has now is what was saved; nothing is left to clean up.
    unsaved.clear();
    update((current) => withSavedItem(current, item));
    // The wish is fulfilled; if taking it off fails it stays on the list, where it can be removed.
    if (fromWish) {
      try {
        await remote.remove("wishItem", fromWish.id);
        update((current) => withoutObject(current, "wishItem", fromWish.id));
      } catch {
        // Nothing to undo: the object is saved.
      }
    }
    // Replace the form in the history, so "Zurück" does not return to a stale form.
    location.replace(detailHash({ type, id }));
  };

  const title =
    form.mode === "edit" && start.existing
      ? T.titleEdit(start.existing.name)
      : form.mode === "copy"
        ? T.titleCopy
        : form.mode === "wish"
          ? T.titleWish[form.type]
          : form.mode === "catalog"
            ? T.titleCatalog[form.type]
            : T.titleNew[type];

  const saveMod = (part: ModPart) =>
    set({
      mods: values.mods.some((mod) => mod.id === part.id)
        ? values.mods.map((mod) => (mod.id === part.id ? part : mod))
        : [...values.mods, part],
    });
  const spend = modSpend({ mods: values.mods });

  return (
    <form class="form" noValidate onSubmit={(event) => void submit(event)} aria-label={title}>
      <header class="page-header">
        <a class="icon-button back-link pressable" href={cancelHash(form)} aria-label={T.cancel}>
          <Icon name="close" />
        </a>
        <h1 class="page-title page-title--small" tabIndex={-1}>
          {title}
        </h1>
        <span class="header-spacer" />
      </header>

      {catalogForm && catalogForm.prefilled.length > 0 && (
        <p class="banner banner--catalog">
          {catalogForm.origin === "link"
            ? CT.linkBanner
            : catalogForm.origin === "wish"
              ? CT.wishBanner
              : CT.banner}
        </p>
      )}
      {notice && <p class="banner">{notice}</p>}
      {linkImage?.status === "loading" && takeImage && (
        <p class="banner" role="status">
          {CT.imageLoading(imageSource ?? "")}
        </p>
      )}
      {linkImage?.status === "ready" && takeImage && (
        <div class="banner banner--catalog banner--action" role="status">
          <span>{CT.imageTaken(imageSource ?? "")}</span>
          <button
            type="button"
            class="photo-job__button pressable"
            onClick={() => setTakeImage(false)}
          >
            {CT.imageSkip}
          </button>
        </div>
      )}
      {linkImage?.status === "failed" && <p class="banner">{CT.imageFailed}</p>}
      {summary > 0 && (
        <p class="banner banner--error" role="alert">
          {T.summary(summary)}
        </p>
      )}
      {failure && (
        <p class="banner banner--error" role="alert">
          {failure}
        </p>
      )}

      <FormCard id="photos" title={T.sections.photos}>
        <PhotoField
          photos={values.photos}
          onPhotos={(change) =>
            setValues((current) => ({ ...current, photos: change(current.photos) }))
          }
          remote={remote}
          folder={id}
          unsaved={unsaved}
          name={values.name || title}
          initialFile={initialPhoto}
        />
      </FormCard>

      <FormCard id="basics" title={T.sections.basics}>
        {text("name", T.fields.name)}
        {shown.includes("number") &&
          text("number", T.fields.number[type], {
            hint: catalogForm?.numberMissing ? CT.numberMissing : undefined,
          })}
        <Choice
          legend={T.fields.manufacturer}
          options={MANUFACTURERS.map((value) => ({ value, label: T.manufacturers[value] }))}
          value={values.manufacturerKind}
          onChange={(manufacturerKind) => set({ manufacturerKind })}
        />
        {(values.manufacturerKind === "other" || values.manufacturerKind === "custom") &&
          text("manufacturerName", T.fields.manufacturerName)}
        {text("theme", T.fields.theme)}
        {type === "legoSet" && (
          <>
            {text("year", T.fields.year, { inputMode: "numeric" })}
            {text("pieceCount", T.fields.pieceCount, { inputMode: "numeric" })}
            {text("minifigCount", T.fields.minifigCount, { inputMode: "numeric" })}
          </>
        )}
        {type === "specialPart" && (
          <Choice
            legend={T.sections.kind}
            options={(["gwp", "coin", "other"] as const).map((value) => ({
              value,
              label: TEXTS.specialPartKinds[value].long,
            }))}
            value={values.kind}
            onChange={(kind) => set({ kind })}
          />
        )}
      </FormCard>

      <FormCard id="condition" title={T.sections.condition}>
        <Choice
          segmented
          hideLegend
          legend={T.sections.condition}
          options={(["new", "used"] as const).map((value) => ({
            value,
            label: TEXTS.conditions[value],
          }))}
          value={values.condition}
          onChange={(condition) => set({ condition })}
        />
        {type === "legoSet" && (
          <Choice
            legend={T.sections.status}
            options={(["complete", "figuresRemoved", "disassembled"] as const).map((value) => ({
              value,
              label: TEXTS.setStatus[value],
            }))}
            value={values.status}
            onChange={(status) => set({ status })}
          />
        )}
      </FormCard>

      <FormCard id="origin" title={T.sections.origin}>
        {text("source", T.fields.source)}
        {text("acquired", T.fields.acquired, { placeholder: T.fields.acquiredPlaceholder })}
        {text("purchasePrice", T.fields.purchasePrice, {
          inputMode: "decimal",
          placeholder: T.fields.pricePlaceholder,
        })}
        {type === "minifig" &&
          text("fromSet", T.fields.fromSet, {
            placeholder: T.fields.fromSetPlaceholder,
            hint: catalogForm?.sets.length
              ? CT.fromSetHint(catalogForm.sets.map((set) => shortSetNumber(set.number)))
              : undefined,
          })}
      </FormCard>

      <FormCard id="value" title={T.sections.value}>
        {text("manualValue", T.fields.manualValue, {
          inputMode: "decimal",
          placeholder: T.fields.pricePlaceholder,
          hint: T.fields.manualValueHint,
        })}
      </FormCard>

      {type === "minifig" && (
        <FormCard
          id="mods"
          title={T.sections.mods}
          badge={
            values.mods.length > 0 && (
              <span class="pill pill--pop">{T.mods.count(values.mods.length)}</span>
            )
          }
        >
          {values.mods.length === 0 ? (
            <p class="card__text">{T.mods.none}</p>
          ) : (
            <ul class="mod-edit-list">
              {values.mods.map((mod) => {
                const position = TEXTS.modPositions[mod.position];
                return (
                  <li key={mod.id} class="mod-edit">
                    <button
                      type="button"
                      class="mod-edit__main pressable"
                      onClick={() => setModSheet({ part: mod })}
                    >
                      <span class="mod-list__position">{position}</span>
                      <span class="tile__meta">{mod.description}</span>
                      <span class="visually-hidden">{T.mods.edit}</span>
                    </button>
                    {mod.price !== undefined && (
                      <span class="mod-list__price">{formatMoney(mod.price)}</span>
                    )}
                    <button
                      type="button"
                      class="icon-button icon-button--small pressable"
                      aria-label={T.mods.remove(`${position}: ${mod.description}`)}
                      onClick={() =>
                        set({ mods: values.mods.filter((candidate) => candidate.id !== mod.id) })
                      }
                    >
                      <Icon name="close" size={18} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {spend > 0 && (
            <div class="mod-total">
              <div class="mod-total__text">
                <span class="mod-list__position">{T.mods.spend}</span>
                <span class="tile__meta">{TEXTS.detail.mods.notInValue}</span>
              </div>
              <span class="mod-total__amount">{formatMoney(spend)}</span>
            </div>
          )}
          <button
            type="button"
            class="button button--secondary pressable"
            onClick={() => setModSheet({})}
          >
            <Icon name="plus" size={20} />
            {T.mods.add}
          </button>
        </FormCard>
      )}

      <FormCard id="note" title={T.sections.note}>
        {text("note", T.fields.note, { rows: 3 })}
        {text("links", T.fields.links, { rows: 2 })}
      </FormCard>

      <div class="form-bar">
        <ReadOnlyNote />
        <button
          type="submit"
          class="button button--primary pressable"
          disabled={saving || !writable}
        >
          <Icon name="check" size={20} />
          {saving ? T.saving : T.save}
        </button>
      </div>

      {modSheet && (
        <ModSheet
          part={modSheet.part}
          newId={() => newId("mod")}
          onSave={saveMod}
          onClose={() => setModSheet(null)}
        />
      )}
    </form>
  );
}

type CatalogLoad =
  | { readonly status: "loading" }
  | { readonly status: "failed"; readonly notFound: boolean }
  | { readonly status: "ready"; readonly catalogForm: CatalogForm };

/** Fetches the catalog entry of `#/erfassen/figur/katalog/<nummer>`, then shows the form filled. */
function CatalogFormLoader({
  form,
  collection,
  remote,
  update,
  catalog,
}: {
  readonly form: Extract<FormRef, { mode: "catalog" }>;
  readonly collection: Collection;
  readonly remote: Remote | undefined;
  readonly update: LoadedCollection["update"];
  readonly catalog: Catalog | undefined;
}) {
  const [load, setLoad] = useState<CatalogLoad>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const { type, ref, link } = form;

  useEffect(() => {
    let active = true;
    setLoad({ status: "loading" });
    const fetched = catalog
      ? catalog.item(type, ref)
      : Promise.reject(new CatalogCallError("Kein Katalog", "unavailable"));
    fetched.then(
      (item) => active && setLoad({ status: "ready", catalogForm: formFromCatalog(item, link) }),
      (error: unknown) =>
        active &&
        setLoad({
          status: "failed",
          notFound: error instanceof CatalogCallError && error.failure === "not_found",
        }),
    );
    return () => {
      active = false;
    };
  }, [catalog, type, ref, link, attempt]);

  if (load.status === "ready") {
    return (
      <FormBody
        form={form}
        collection={collection}
        start={{ values: load.catalogForm.values, existing: undefined }}
        remote={remote}
        update={update}
        catalogForm={load.catalogForm}
      />
    );
  }
  return (
    <>
      <header class="page-header">
        <a class="icon-button back-link pressable" href={cancelHash(form)} aria-label={T.cancel}>
          <Icon name="close" />
        </a>
      </header>
      {load.status === "loading" ? (
        <div class="skeleton" role="status" aria-busy="true" aria-label={CT.loading}>
          <div class="skeleton__card" />
          <div class="skeleton__card" />
        </div>
      ) : (
        <section class="card" role="alert" aria-labelledby="catalog-failed-title">
          <h1 class="card__title" id="catalog-failed-title" tabIndex={-1}>
            {CT.failed.title}
          </h1>
          <p class="card__text">{load.notFound ? CT.failed.notFound : CT.failed.text}</p>
          {!load.notFound && (
            <button
              type="button"
              class="button button--secondary pressable"
              onClick={() => setAttempt((count) => count + 1)}
            >
              {CT.failed.retry}
            </button>
          )}
          <a
            class="button button--secondary button--flat pressable"
            href={formHash({ type, mode: "new" })}
          >
            {CT.failed.manual}
          </a>
        </section>
      )}
    </>
  );
}

/**
 * "Erhalten" (F14): the form filled from the wish. A LEGO set with a number also gets what the
 * catalog adds (its figures, F7; P15), like a set entered from the catalog. If the catalog cannot be
 * asked, the form opens from the wish alone and says so.
 */
function WishFormLoader({
  form,
  wish,
  collection,
  remote,
  update,
  catalog,
}: {
  readonly form: Extract<FormRef, { mode: "wish" }>;
  readonly wish: WishItem;
  readonly collection: Collection;
  readonly remote: Remote | undefined;
  readonly update: LoadedCollection["update"];
  readonly catalog: Catalog | undefined;
}) {
  const fromCatalog =
    wish.type === "legoSet" &&
    wish.manufacturer.kind === "lego" &&
    (wish.setNumber ?? "").trim() !== "" &&
    catalog !== undefined;
  const [load, setLoad] = useState<
    | { readonly status: "loading" }
    | { readonly status: "ready"; readonly wishForm: CatalogForm; readonly failed: boolean }
  >(() =>
    fromCatalog
      ? { status: "loading" }
      : { status: "ready", wishForm: formFromWish(wish), failed: false },
  );

  useEffect(() => {
    if (!fromCatalog || !catalog || !wish.setNumber) return;
    let active = true;
    catalog.item("legoSet", wish.setNumber).then(
      (item) =>
        active &&
        setLoad({
          status: "ready",
          wishForm: withCatalogEntry(formFromWish(wish), item),
          failed: false,
        }),
      () => active && setLoad({ status: "ready", wishForm: formFromWish(wish), failed: true }),
    );
    return () => {
      active = false;
    };
  }, []);

  if (load.status === "loading") {
    return (
      <>
        <header class="page-header">
          <a class="icon-button back-link pressable" href={cancelHash(form)} aria-label={T.cancel}>
            <Icon name="close" />
          </a>
        </header>
        <div class="skeleton" role="status" aria-busy="true" aria-label={CT.loading}>
          <div class="skeleton__card" />
          <div class="skeleton__card" />
        </div>
      </>
    );
  }
  return (
    <FormBody
      form={form}
      collection={collection}
      start={{ values: load.wishForm.values, existing: undefined }}
      remote={remote}
      update={update}
      catalogForm={load.wishForm}
      fromWish={wish}
      notice={load.failed ? CT.wishCatalogFailed : undefined}
    />
  );
}

type LinkLoad =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly fields: PageFields; readonly unreadable: boolean };

/**
 * The form of `#/erfassen/<art>/link/<adresse>` (F3): filled from what the page gave (held from the
 * page before, else read again, e.g. after a reload). Whatever goes wrong, the form opens with the
 * link saved and the rest empty.
 */
function LinkFormLoader({
  form,
  collection,
  remote,
  update,
  previewer,
}: {
  readonly form: Extract<FormRef, { mode: "link" }>;
  readonly collection: Collection;
  readonly remote: Remote | undefined;
  readonly update: LoadedCollection["update"];
  readonly previewer: LinkPreviewer | undefined;
}) {
  const { type, link } = form;
  const [load, setLoad] = useState<LinkLoad>(() => {
    const held = CaptureLink.peek(link);
    return held?.kind === "page"
      ? { status: "ready", fields: held.fields, unreadable: !hasFields(held.fields) }
      : { status: "loading" };
  });

  useEffect(() => {
    if (load.status === "ready") return;
    let active = true;
    const read = previewer ? previewer.preview(link) : Promise.reject(new Error("Keine Vorschau"));
    read.then(
      (answer) =>
        active &&
        setLoad(
          answer.kind === "page"
            ? { status: "ready", fields: answer.fields, unreadable: !hasFields(answer.fields) }
            : { status: "ready", fields: {}, unreadable: true },
        ),
      () => active && setLoad({ status: "ready", fields: {}, unreadable: true }),
    );
    return () => {
      active = false;
    };
  }, [previewer, link, load.status]);

  const linkImage = useLinkImage(
    previewer,
    load.status === "ready" ? load.fields.imageUrl : undefined,
  );

  if (load.status === "loading") {
    return (
      <>
        <header class="page-header">
          <a class="icon-button back-link pressable" href={cancelHash(form)} aria-label={T.cancel}>
            <Icon name="close" />
          </a>
        </header>
        <div class="skeleton" role="status" aria-busy="true" aria-label={CT.linkLoading}>
          <div class="skeleton__card" />
          <div class="skeleton__card" />
        </div>
      </>
    );
  }
  return (
    <FormBody
      form={form}
      collection={collection}
      start={{ values: formFromLink(type, link, load.fields).values, existing: undefined }}
      remote={remote}
      update={update}
      catalogForm={formFromLink(type, link, load.fields)}
      linkImage={linkImage}
      imageSource={hostOf(link)}
      notice={load.unreadable ? CT.linkUnreadable : undefined}
    />
  );
}

/** S8: the form to enter a figure, a set or a special part, or to change one (and `mods` of S8a). */
export function FormPage({
  data,
  form,
  remote,
  catalog,
  previewer,
}: {
  readonly data: LoadedCollection;
  readonly form: FormRef;
  readonly remote: Remote | undefined;
  readonly catalog?: Catalog | undefined;
  readonly previewer?: LinkPreviewer | undefined;
}) {
  const { state } = data;
  if (state.status !== "ready") {
    return (
      <>
        <header class="page-header">
          <a class="icon-button back-link pressable" href={cancelHash(form)} aria-label={T.cancel}>
            <Icon name="close" />
          </a>
        </header>
        {state.status === "loading" ? (
          <div class="skeleton" role="status" aria-label={TEXTS.showcase.loading} aria-busy="true">
            <div class="skeleton__card" />
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
  if (form.mode === "catalog") {
    return (
      <CatalogFormLoader
        form={form}
        collection={state.collection}
        remote={remote}
        update={data.update}
        catalog={catalog}
      />
    );
  }
  if (form.mode === "link") {
    return (
      <LinkFormLoader
        form={form}
        collection={state.collection}
        remote={remote}
        update={data.update}
        previewer={previewer}
      />
    );
  }
  if (form.mode === "wish") {
    const wish = state.collection.wishlist.find((candidate) => candidate.id === form.id);
    if (wish) {
      return (
        <WishFormLoader
          key={wish.id}
          form={form}
          wish={wish}
          collection={state.collection}
          remote={remote}
          update={data.update}
          catalog={catalog}
        />
      );
    }
  }
  const start = startOf(form, state.collection);
  if (!start) {
    return (
      <section class="card" aria-labelledby="form-not-found-title">
        <h1 class="card__title" id="form-not-found-title" tabIndex={-1}>
          {T.notFound.title}
        </h1>
        <p class="card__text">{T.notFound.text}</p>
        <a class="button button--secondary pressable" href={routeHash("showcase")}>
          {TEXTS.detail.back}
        </a>
      </section>
    );
  }
  return (
    <FormBody
      form={form}
      collection={state.collection}
      start={start}
      remote={remote}
      update={data.update}
    />
  );
}
