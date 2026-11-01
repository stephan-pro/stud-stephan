import { useRef, useState } from "preact/hooks";
import { type Remote, RemoteError } from "../../backend/remote";
import { formatDate } from "../../domain/dates";
import type { Id, StudioFile } from "../../domain/types";
import { saveAsFile } from "../../files/browserDownload";
import { formatBytes } from "../../files/bytes";
import { StudioFileRefused, uploadStudioFile } from "../../files/studioUpload";
import { newId } from "../ids";
import { TEXTS } from "../texts";
import { Icon } from "./Icon";

const T = TEXTS.dioramas.studio;

/** A file on its way: being sent, waiting for the next try, being entered, or failed. */
interface Job {
  readonly key: number;
  readonly file: File;
  readonly step: "sending" | "waiting" | "saving" | "failed";
  readonly attempt: number;
  readonly attempts: number;
  readonly failure?: { readonly message: string; readonly again: boolean };
}

function jobLabel(job: Job): string {
  const name = job.file.name;
  if (job.step === "sending") return T.sending(name, job.attempt, job.attempts);
  if (job.step === "waiting") return T.waiting(name);
  if (job.step === "saving") return T.saving;
  return job.failure?.message ?? T.failed(name);
}

interface StudioPickerProps {
  /** The server's files; none in a build without a server. */
  readonly remote: Pick<Remote, "putFile" | "removeFile"> | undefined;
  readonly dioramaId: Id;
  /** How many more files the diorama takes. */
  readonly room: number;
  /**
   * Called with the entry of a file that is stored. If it rejects, the file is taken out of
   * storage again and the person is told (the detail page saves the diorama here).
   */
  readonly onAdded: (entry: StudioFile) => void | Promise<void>;
}

/**
 * "Datei hochladen": picks `.io` files, sends each with retries (`uploadFile`) and shows how far
 * it got. Used in the diorama form and on the detail page.
 */
export function StudioPicker({ remote, dioramaId, room, onAdded }: StudioPickerProps) {
  const [jobs, setJobs] = useState<readonly Job[]>([]);
  const nextKey = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const space = room - jobs.length;

  const patch = (key: number, fields: Partial<Job>) =>
    setJobs((current) => current.map((job) => (job.key === key ? { ...job, ...fields } : job)));
  const drop = (key: number) => setJobs((current) => current.filter((job) => job.key !== key));

  const run = async (job: Job) => {
    if (!remote) return;
    patch(job.key, { step: "sending", attempt: 1 });
    const fileId = newId("studio");
    let entry: StudioFile;
    try {
      entry = await uploadStudioFile(
        remote,
        dioramaId,
        fileId,
        job.file,
        new Date().toISOString(),
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
    } catch (error) {
      const name = job.file.name;
      const failure =
        error instanceof StudioFileRefused
          ? { message: `${name}: ${T.problems[error.problem]}`, again: false }
          : error instanceof RemoteError && error.permanent
            ? { message: `${name}: ${T.problems.refused}`, again: false }
            : { message: T.failed(name), again: true };
      patch(job.key, { step: "failed", failure });
      return;
    }
    patch(job.key, { step: "saving" });
    try {
      await onAdded(entry);
      drop(job.key);
    } catch {
      void remote.removeFile("studio-files", entry.path).catch(() => {});
      patch(job.key, {
        step: "failed",
        failure: { message: `${job.file.name}: ${T.uploadFailed}`, again: true },
      });
    }
  };

  const add = (files: FileList | null) => {
    if (!files) return;
    for (const file of [...files].slice(0, Math.max(0, space))) {
      const job: Job = { key: nextKey.current++, file, step: "sending", attempt: 1, attempts: 4 };
      setJobs((current) => [...current, job]);
      void run(job);
    }
    // The same file can be chosen again after it was taken out.
    if (input.current) input.current.value = "";
  };

  return (
    <>
      {jobs.length > 0 && (
        <ul class="studio-jobs">
          {jobs.map((job) => (
            <li key={job.key} class="studio-job">
              <span class="studio-job__text" role="status">
                {jobLabel(job)}
              </span>
              {job.step === "failed" && (
                <span class="photo-job__actions">
                  {job.failure?.again && (
                    <button
                      type="button"
                      class="photo-job__button pressable"
                      onClick={() => void run(job)}
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
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        class="button button--secondary pressable"
        disabled={!remote || space <= 0}
        onClick={() => input.current?.click()}
      >
        <Icon name="upload" size={20} />
        {T.upload}
      </button>
      <input
        ref={input}
        hidden
        type="file"
        accept=".io"
        multiple
        aria-label={T.upload}
        onChange={(event) => add(event.currentTarget.files)}
      />
      <p class="card__text">{space > 0 ? T.hint : T.full}</p>
      {!remote && <p class="card__text">{T.noServer}</p>}
    </>
  );
}

interface StudioListProps {
  readonly files: readonly StudioFile[];
  readonly remote: Pick<Remote, "getFile"> | undefined;
  /** Shows a remove button per file (the form); without it the list only downloads. */
  readonly onRemove?: ((file: StudioFile) => void) | undefined;
}

/** The Studio files of a diorama: name, size and day, a button to download each one. */
export function StudioList({ files, remote, onRemove }: StudioListProps) {
  const [busy, setBusy] = useState<Id | undefined>();
  const [failed, setFailed] = useState(false);

  const download = async (file: StudioFile) => {
    if (!remote || busy) return;
    setBusy(file.id);
    setFailed(false);
    try {
      saveAsFile(await remote.getFile("studio-files", file.path), file.fileName);
    } catch {
      setFailed(true);
    }
    setBusy(undefined);
  };

  if (files.length === 0) return null;
  return (
    <>
      <ul class="studio-list">
        {files.map((file) => (
          <li key={file.id} class="studio-row">
            <span class="studio-row__badge" aria-hidden="true">
              .io
            </span>
            <div class="studio-row__text">
              <span class="studio-row__name">{file.fileName}</span>
              <span class="tile__meta">
                {T.meta(formatBytes(file.sizeBytes), formatDate(file.uploadedAt.slice(0, 10)))}
              </span>
            </div>
            <button
              type="button"
              class="icon-button pressable"
              aria-label={T.download(file.fileName)}
              aria-busy={busy === file.id}
              disabled={!remote || busy !== undefined}
              onClick={() => void download(file)}
            >
              <Icon name="download" />
            </button>
            {onRemove && (
              <button
                type="button"
                class="icon-button pressable"
                aria-label={T.remove(file.fileName)}
                onClick={() => onRemove(file)}
              >
                <Icon name="close" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {failed && (
        <p class="field__error" role="alert">
          {T.downloadFailed}
        </p>
      )}
    </>
  );
}
