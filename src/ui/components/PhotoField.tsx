import { useEffect, useRef, useState } from "preact/hooks";
import { type Remote, RemoteError } from "../../backend/remote";
import { LIMITS } from "../../backend/rules";
import { focusOf, type PhotoFocusMap } from "../../domain/photoFocus";
import type { PhotoFocus } from "../../domain/types";
import { PhotoError, resizePhoto } from "../../files/browserPhoto";
import { uploadFile } from "../../files/upload";
import { TEXTS } from "../texts";
import { Cover } from "./Cover";
import { FocusSheet } from "./FocusSheet";
import { Icon } from "./Icon";

const T = TEXTS.form.photos;

/** A photo on its way: being made small, being sent, waiting for the next try, or failed. */
interface Job {
  readonly key: number;
  readonly file: File;
  readonly step: "resizing" | "sending" | "waiting" | "failed";
  readonly attempt: number;
  readonly attempts: number;
  /** Why it failed; `again` says whether another try may work (not for a refusal). */
  readonly failure?: { readonly message: string; readonly again: boolean };
}

interface PhotoFieldProps {
  /** Paths of the object's photos in storage, the first is the cover. */
  readonly photos: readonly string[];
  /** Changes the list; takes a function so photos that arrive together do not overwrite each other. */
  readonly onPhotos: (change: (photos: string[]) => string[]) => void;
  /** The point of each photo that matters, by path; photos without one show their middle. */
  readonly focus: PhotoFocusMap;
  /** A photo's point was set. */
  readonly onFocus: (path: string, focus: PhotoFocus) => void;
  /** The server's files; none in a build without a server. */
  readonly remote: Pick<Remote, "putFile" | "removeFile"> | undefined;
  /** The object's folder in storage: "<id>/photo-….webp". */
  readonly folder: string;
  /**
   * Photos sent in this form and not saved yet. A photo taken out again is removed from storage
   * at once, the rest is cleaned up by the form if it is cancelled.
   */
  readonly unsaved: Set<string>;
  readonly name: string;
  /** A photo to send as soon as the form opens (the one taken for the recognition). */
  readonly initialFile?: File | undefined;
}

const EXTENSIONS: Readonly<Record<string, string>> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/** The name of a new photo in storage: `<folder>/photo-<stamp>.<extension>`. */
export function photoFileName(folder: string, contentType: string): string {
  const stamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  return `${folder}/photo-${stamp}.${EXTENSIONS[contentType] ?? "webp"}`;
}

function jobLabel(job: Job): string {
  if (job.step === "resizing") return T.working;
  if (job.step === "sending") return T.sending(job.attempt, job.attempts);
  if (job.step === "waiting") return T.waiting;
  return job.failure?.message ?? T.failed;
}

/**
 * "Fotos" of a form (S8): the photos of the object, one button to take or pick more. A photo is
 * made small in the browser (`resizePhoto`), then sent with retries (`uploadFile`) and shown as
 * soon as it is stored. The first photo is the cover; any other can be moved up to it.
 */
export function PhotoField({
  photos,
  onPhotos,
  focus,
  onFocus,
  remote,
  folder,
  unsaved,
  name,
  initialFile,
}: PhotoFieldProps) {
  const [jobs, setJobs] = useState<readonly Job[]>([]);
  // The photo whose point is being set.
  const [editing, setEditing] = useState<string | undefined>();
  const nextKey = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const waiting = jobs.length;
  const room = LIMITS.photosPerObject - photos.length - waiting;

  const patch = (key: number, fields: Partial<Job>) =>
    setJobs((current) => current.map((job) => (job.key === key ? { ...job, ...fields } : job)));
  const drop = (key: number) => setJobs((current) => current.filter((job) => job.key !== key));

  const run = async (job: Job) => {
    if (!remote) return;
    patch(job.key, { step: "resizing" });
    try {
      const small = await resizePhoto(job.file);
      const path = await uploadFile(
        remote,
        "photos",
        photoFileName(folder, small.contentType),
        small.bytes,
        small.contentType,
        {
          onProgress: (progress) => {
            if (progress.step === "sending" || progress.step === "waiting") {
              patch(job.key, {
                step: progress.step,
                attempt: progress.attempt,
                attempts: progress.attempts,
              });
            }
          },
        },
      );
      unsaved.add(path);
      onPhotos((current) => [...current, path]);
      drop(job.key);
    } catch (error) {
      const failure =
        error instanceof PhotoError
          ? { message: T.unreadable, again: false }
          : error instanceof RemoteError && error.permanent
            ? { message: T.refused, again: false }
            : { message: T.failed, again: true };
      patch(job.key, { step: "failed", failure });
    }
  };

  const start = (files: readonly File[]) => {
    for (const file of files.slice(0, Math.max(0, room))) {
      const job: Job = { key: nextKey.current++, file, step: "resizing", attempt: 1, attempts: 4 };
      setJobs((current) => [...current, job]);
      void run(job);
    }
  };

  const add = (files: FileList | null) => {
    if (!files) return;
    start([...files]);
    // The same photo can be chosen again after it was taken out.
    if (input.current) input.current.value = "";
  };

  // The photo of the recognition (S7a) is sent like one chosen here, once, when the form opens.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !initialFile || !remote) return;
    started.current = true;
    start([initialFile]);
  }, []);

  const take = (path: string) => {
    onPhotos((current) => current.filter((candidate) => candidate !== path));
    if (unsaved.delete(path)) void remote?.removeFile("photos", path).catch(() => {});
  };

  const makeCover = (path: string) =>
    onPhotos((current) => [path, ...current.filter((candidate) => candidate !== path)]);

  return (
    <>
      <ul class="photo-list">
        {photos.map((path, index) => (
          <li key={path} class="photo-slot">
            <Cover
              image={{ kind: "photo", path, focus: focusOf(focus, path) }}
              alt={`${name}: ${T.alt(index + 1, photos.length)}`}
              tintKey={path}
              scribbleId={`form-photo-${index}`}
              variant="thumb"
            />
            <button
              type="button"
              class="photo-slot__open"
              aria-label={T.setFocus(index + 1)}
              onClick={() => setEditing(path)}
            />
            {index === 0 && <span class="photo-slot__badge">{T.cover}</span>}
            <div class="photo-slot__actions">
              {index > 0 && (
                <button
                  type="button"
                  class="photo-slot__button pressable"
                  aria-label={T.makeCover(index + 1)}
                  onClick={() => makeCover(path)}
                >
                  <Icon name="star" size={16} />
                </button>
              )}
              <button
                type="button"
                class="photo-slot__button pressable"
                aria-label={T.remove(index + 1)}
                onClick={() => take(path)}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          </li>
        ))}
        {jobs.map((job) => (
          <li key={`job-${job.key}`} class="photo-slot photo-slot--job">
            <div class="photo-job" role="status">
              <span class="photo-job__text">{jobLabel(job)}</span>
              {job.step === "failed" && (
                <div class="photo-job__actions">
                  {job.failure?.again && (
                    <button
                      type="button"
                      class="photo-job__button pressable"
                      onClick={() => void run({ ...job, step: "resizing", attempt: 1 })}
                    >
                      {T.retry}
                    </button>
                  )}
                  <button
                    type="button"
                    class="photo-job__button pressable"
                    onClick={() => drop(job.key)}
                  >
                    {T.discard}
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
        {room > 0 && (
          <li>
            <button
              type="button"
              class="photo-add pressable"
              aria-label={T.add}
              disabled={!remote}
              onClick={() => input.current?.click()}
            >
              <Icon name="camera" size={24} />
            </button>
          </li>
        )}
      </ul>
      {/* Opened by the button; a phone offers the camera and the gallery for "image/*". */}
      <input
        ref={input}
        hidden
        type="file"
        accept="image/*"
        multiple
        onChange={(event) => add(event.currentTarget.files)}
      />
      {editing !== undefined && photos.includes(editing) && (
        <FocusSheet
          path={editing}
          name={name}
          focus={focusOf(focus, editing)}
          onSave={(point) => onFocus(editing, point)}
          onClose={() => setEditing(undefined)}
        />
      )}
      <p class="card__text">{room > 0 ? T.hint : T.full}</p>
      {!remote && <p class="card__text">{T.noServer}</p>}
    </>
  );
}
