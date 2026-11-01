import { useEffect, useRef, useState } from "preact/hooks";
import { type Remote, RemoteError } from "../../backend/remote";
import { LIMITS } from "../../backend/rules";
import { withSaved } from "../../domain/collectionEdit";
import {
  buildDiorama,
  type DioramaFieldKey,
  type DioramaFormErrors,
  type DioramaFormValues,
  emptyDioramaForm,
  firstDioramaError,
  formFromDiorama,
  validateDioramaForm,
} from "../../domain/dioramaForm";
import type { Collection, StudioFile } from "../../domain/types";
import { FormCard, fieldId, TextField } from "../components/Fields";
import { Icon } from "../components/Icon";
import { PhotoField } from "../components/PhotoField";
import { StudioList, StudioPicker } from "../components/StudioFiles";
import { Unready } from "../components/Unready";
import { ReadOnlyNote } from "../components/WriteLink";
import { newId, today } from "../ids";
import { dioramaHash, routeHash } from "../route";
import { TEXTS } from "../texts";
import { type LoadedCollection, useWritable } from "../useCollection";

const T = TEXTS.form;
const D = TEXTS.dioramas.form;
const PREFIX = "diorama";

function saveFailure(error: unknown): string {
  if (error instanceof RemoteError && error.permanent) {
    if (error.reason === "too_many_photos") return T.saveFailed.too_many_photos;
    if (error.reason === "too_large") return T.saveFailed.too_large;
    return T.saveFailed.refused;
  }
  return navigator.onLine ? T.saveFailed.server : T.saveFailed.offline;
}

function FormBody({
  editing,
  collection,
  remote,
  update,
}: {
  /** The id of the diorama being changed; none for a new one. */
  readonly editing: string | undefined;
  readonly collection: Collection;
  readonly remote: Remote | undefined;
  readonly update: LoadedCollection["update"];
}) {
  const existing = collection.dioramas.find((diorama) => diorama.id === editing);
  const [values, setValues] = useState<DioramaFormValues>(
    existing ? formFromDiorama(existing) : emptyDioramaForm(),
  );
  const [errors, setErrors] = useState<DioramaFormErrors>({});
  const [failure, setFailure] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const writable = useWritable();
  const [summary, setSummary] = useState(0);
  const id = useRef(existing?.id ?? newId("diorama")).current;
  // Photos and Studio files sent in this form and not saved yet: removed again if it is left.
  const unsavedPhotos = useRef(new Set<string>()).current;
  const unsavedFiles = useRef(new Set<string>()).current;

  useEffect(
    () => () => {
      for (const path of unsavedPhotos) void remote?.removeFile("photos", path).catch(() => {});
      for (const path of unsavedFiles) {
        void remote?.removeFile("studio-files", path).catch(() => {});
      }
    },
    [remote, unsavedPhotos, unsavedFiles],
  );

  const set = (fields: Partial<DioramaFormValues>) =>
    setValues((current) => ({ ...current, ...fields }));
  const title = existing ? D.titleEdit(existing.name) : D.titleNew;
  const cancel = existing
    ? dioramaHash({ kind: "detail", id: existing.id })
    : routeHash("dioramas");

  const text = (
    field: DioramaFieldKey,
    label: string,
    extra: {
      placeholder?: string;
      inputMode?: "decimal" | "numeric";
      hint?: string;
      rows?: number;
    } = {},
  ) => (
    <TextField
      id={fieldId(PREFIX, field)}
      label={label}
      value={values[field]}
      onInput={(value) => set({ [field]: value })}
      error={errors[field] ? T.errors[errors[field]] : undefined}
      {...extra}
    />
  );

  const removeFile = (file: StudioFile) => {
    set({ studioFiles: values.studioFiles.filter((candidate) => candidate.id !== file.id) });
    if (unsavedFiles.delete(file.path)) {
      void remote?.removeFile("studio-files", file.path).catch(() => {});
    }
  };

  const submit = async (event: Event) => {
    event.preventDefault();
    if (saving) return;
    const found = validateDioramaForm(values);
    setErrors(found);
    const first = firstDioramaError(found);
    if (first) {
      setSummary(Object.keys(found).length);
      setFailure(undefined);
      document.getElementById(fieldId(PREFIX, first))?.focus();
      return;
    }
    setSummary(0);
    if (!remote) {
      setFailure(T.saveFailed.server);
      return;
    }
    const diorama = buildDiorama(values, {
      id,
      createdAt: new Date().toISOString(),
      today: today(),
      existing,
    });
    setSaving(true);
    setFailure(undefined);
    try {
      await remote.save("diorama", diorama);
    } catch (error) {
      setSaving(false);
      setFailure(saveFailure(error));
      return;
    }
    unsavedPhotos.clear();
    unsavedFiles.clear();
    update((current) => withSaved(current, "diorama", diorama));
    location.replace(dioramaHash({ kind: "detail", id }));
  };

  return (
    <form class="form" noValidate onSubmit={(event) => void submit(event)} aria-label={title}>
      <header class="page-header">
        <a class="icon-button back-link pressable" href={cancel} aria-label={T.cancel}>
          <Icon name="close" />
        </a>
        <h1 class="page-title page-title--small" tabIndex={-1}>
          {title}
        </h1>
        <span class="header-spacer" />
      </header>

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

      <FormCard id="photos" title={D.sections.photos}>
        <PhotoField
          photos={values.photos}
          onPhotos={(change) =>
            setValues((current) => ({ ...current, photos: change(current.photos) }))
          }
          remote={remote}
          folder={id}
          unsaved={unsavedPhotos}
          name={values.name || title}
        />
      </FormCard>

      <FormCard id="basics" title={D.sections.basics}>
        {text("name", D.fields.name)}
        {text("pieceCount", D.fields.pieceCount, { inputMode: "numeric" })}
      </FormCard>

      <FormCard id="value" title={D.sections.value}>
        {text("manualValue", D.fields.manualValue, {
          inputMode: "decimal",
          placeholder: T.fields.pricePlaceholder,
          hint: D.fields.manualValueHint,
        })}
      </FormCard>

      <FormCard id="studio" title={D.sections.studio}>
        <StudioList files={values.studioFiles} remote={remote} onRemove={removeFile} />
        <StudioPicker
          remote={remote}
          dioramaId={id}
          room={LIMITS.studioFilesPerDiorama - values.studioFiles.length}
          onAdded={(entry) => {
            unsavedFiles.add(entry.path);
            setValues((current) => ({
              ...current,
              studioFiles: [...current.studioFiles, entry],
            }));
          }}
        />
      </FormCard>

      <FormCard id="note" title={D.sections.note}>
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
    </form>
  );
}

/** The form to enter a diorama or to change one: photos, Studio files, note and links (F8). */
export function DioramaFormPage({
  data,
  editing,
  remote,
}: {
  readonly data: LoadedCollection;
  /** The id of the diorama to change; none enters a new one. */
  readonly editing: string | undefined;
  readonly remote: Remote | undefined;
}) {
  if (data.state.status !== "ready") {
    return (
      <>
        <header class="page-header">
          <a
            class="icon-button back-link pressable"
            href={routeHash("dioramas")}
            aria-label={T.cancel}
          >
            <Icon name="close" />
          </a>
        </header>
        <Unready data={data} />
      </>
    );
  }
  const { collection } = data.state;
  if (editing && !collection.dioramas.some((diorama) => diorama.id === editing)) {
    return (
      <section class="card" aria-labelledby="form-not-found-title">
        <h1 class="card__title" id="form-not-found-title" tabIndex={-1}>
          {D.notFound.title}
        </h1>
        <p class="card__text">{D.notFound.text}</p>
        <a class="button button--secondary pressable" href={routeHash("dioramas")}>
          {TEXTS.dioramas.back}
        </a>
      </section>
    );
  }
  return (
    <FormBody editing={editing} collection={collection} remote={remote} update={data.update} />
  );
}
