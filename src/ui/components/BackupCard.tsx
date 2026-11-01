import { useEffect, useRef, useState } from "preact/hooks";
import type { Remote } from "../../backend/remote";
import { estimateBackupBytes } from "../../backup/exportBackup";
import { backupFileName } from "../../backup/format";
import { type ImportProgress, importBackup, makeBackup } from "../../backup/makeBackup";
import { type ParsedBackup, readBackup } from "../../backup/readBackup";
import { RestoreError } from "../../backup/restoreBackup";
import { type ByteSource, blobSource } from "../../backup/zip";
import { backupNotice } from "../../domain/backupReminder";
import { formatDate, formatDateTime } from "../../domain/dates";
import type { Collection } from "../../domain/types";
import { saveBlob } from "../../files/browserDownload";
import { formatBytes } from "../../files/bytes";
import { type BackupStamp, deviceStamp } from "../backupStamp";
import { problemText, summaryText } from "../backupText";
import { today as todayOnDevice } from "../ids";
import { TEXTS } from "../texts";
import { Rows } from "./DetailParts";
import { Sheet } from "./Sheet";

/** From this size on the card advises the WLAN. */
const BIG_BACKUP_BYTES = 50_000_000;

interface BackupCardProps {
  readonly remote: Remote;
  /** The collection as shown; gives the numbers in the question before replacing and the size. */
  readonly collection: Collection | undefined;
  /** The data on the server changed (import): the app reads the collection again. */
  readonly onRestored: () => void;
  readonly now?: () => Date;
  readonly stamp?: BackupStamp;
  /** Hands a file to the person; default: a download. */
  readonly deliver?: (blob: Blob, fileName: string) => void;
}

interface Message {
  readonly tone: "ok" | "error";
  readonly lines: readonly string[];
}

interface Pending {
  readonly backup: ParsedBackup;
  readonly source: ByteSource;
}

function progressText(progress: ImportProgress): string {
  const T = TEXTS.backup.progress;
  if (progress.step === "backup") {
    return progress.done >= progress.total && progress.total > 0
      ? T.checking
      : T.before(progress.done, progress.total);
  }
  switch (progress.phase) {
    case "files":
      return T.uploading(progress.done, progress.total);
    case "objects":
      return T.objects(progress.done, progress.total);
    case "prices":
      return T.prices(progress.done, progress.total);
    case "cleanup":
      return T.cleanup;
  }
}

/**
 * S12, card "Datensicherung" (P14, F15): Export and Import as in the click dummy, plus the size
 * of the file to expect, the day of the last backup with a gentle reminder after 30 days, and the
 * question with a summary before a backup replaces the collection.
 */
export function BackupCard({
  remote,
  collection,
  onRestored,
  now = () => new Date(),
  stamp = deviceStamp,
  deliver = saveBlob,
}: BackupCardProps) {
  const T = TEXTS.backup;
  const [busy, setBusy] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState<Message | undefined>(undefined);
  const [pending, setPending] = useState<Pending | undefined>(undefined);
  const [lastDay, setLastDay] = useState(() => stamp.read());
  const [storageBytes, setStorageBytes] = useState<number | undefined>(undefined);
  const picker = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  // The size to expect: what the files take plus the data. The numbers change with each import.
  useEffect(() => {
    let active = true;
    remote.storageUsage().then(
      (bytes) => active && setStorageBytes(bytes),
      () => active && setStorageBytes(undefined),
    );
    return () => {
      active = false;
    };
  }, [remote, collection]);

  const estimate =
    collection !== undefined && storageBytes !== undefined
      ? estimateBackupBytes(collection, storageBytes)
      : undefined;
  const notice = backupNotice(lastDay, todayOnDevice());

  const remember = (day: string) => {
    stamp.write(day);
    setLastDay(day);
  };

  const exportNow = async () => {
    setBusy(T.progress.reading);
    setMessage(undefined);
    try {
      const moment = now();
      const made = await makeBackup({
        remote,
        now: moment,
        onProgress: ({ done, total }) => {
          if (mounted.current) {
            setBusy(
              done >= total && total > 0 ? T.progress.checking : T.progress.files(done, total),
            );
          }
        },
      });
      const day = todayOnDevice();
      const fileName = backupFileName(day);
      deliver(made.blob, fileName);
      remember(day);
      setMessage({
        tone: "ok",
        lines: [
          T.exported(fileName, summaryText(made.result.summary), formatBytes(made.result.bytes)),
          ...(made.result.skipped > 0 ? [T.skipped(made.result.skipped)] : []),
        ],
      });
    } catch (error) {
      setMessage({ tone: "error", lines: [problemText(error, false)] });
    } finally {
      if (mounted.current) setBusy(undefined);
    }
  };

  const choose = async (file: File) => {
    setBusy(T.progress.checkingFile);
    setMessage(undefined);
    try {
      const source = blobSource(file);
      setPending({ backup: await readBackup(source), source });
    } catch (error) {
      setMessage({ tone: "error", lines: [problemText(error, true)] });
    } finally {
      if (mounted.current) setBusy(undefined);
    }
  };

  const replace = async ({ backup, source }: Pending) => {
    setMessage(undefined);
    setBusy(T.progress.reading);
    let backupName: string | undefined;
    try {
      await importBackup({
        remote,
        source,
        backup,
        now: now(),
        deliver: (blob, fileName) => {
          // The person has the file before anything is replaced.
          deliver(blob, fileName);
          backupName = fileName;
          remember(todayOnDevice());
        },
        onProgress: (progress) => mounted.current && setBusy(progressText(progress)),
      });
      setMessage({
        tone: "ok",
        lines: [T.imported(formatDate(backup.summary.exportedAt.slice(0, 10)), backupName ?? "")],
      });
    } catch (error) {
      setMessage({
        tone: "error",
        lines: [
          error instanceof RestoreError
            ? error.restored
              ? T.restoreFailed.restored(backupName)
              : T.restoreFailed.notRestored(backupName)
            : problemText(error, true),
        ],
      });
    } finally {
      // The server's state may have changed even when it failed: read it again.
      onRestored();
      if (mounted.current) setBusy(undefined);
    }
  };

  const rows = (summary: ParsedBackup["summary"]) => {
    const keys = ["minifigs", "sets", "specialParts", "dioramas", "wishlist"] as const;
    const current = collection && {
      minifigs: collection.minifigs.length,
      sets: collection.sets.length,
      specialParts: collection.specialParts.length,
      dioramas: collection.dioramas.length,
      wishlist: collection.wishlist.length,
    };
    return keys.map((key) => ({
      label: T.counts[key][1],
      value: current ? `${current[key]} → ${summary[key]}` : String(summary[key]),
    }));
  };

  return (
    <section class="card backup" aria-labelledby="backup-title">
      <h2 class="card__title" id="backup-title">
        {T.title}
      </h2>
      <p class="card__text">{T.intro}</p>
      {estimate !== undefined && (
        <p class="card__text">
          {T.size(formatBytes(estimate))}
          {estimate >= BIG_BACKUP_BYTES ? ` ${T.bigHint}` : ""}
        </p>
      )}
      <p
        class={`note backup__notice${notice.kind === "due" ? " backup__notice--due" : ""}`}
        data-notice={notice.kind}
      >
        {notice.kind === "never"
          ? T.last.never
          : notice.kind === "recent"
            ? T.last.recent(formatDate(notice.date))
            : T.last.due(formatDate(notice.date), notice.days)}
      </p>
      <div class="backup__buttons">
        <button
          class="button button--secondary pressable"
          type="button"
          disabled={busy !== undefined}
          onClick={() => void exportNow()}
        >
          {T.export}
        </button>
        <button
          class="button button--secondary pressable"
          type="button"
          disabled={busy !== undefined}
          onClick={() => picker.current?.click()}
        >
          {T.import}
        </button>
        <input
          ref={picker}
          hidden
          type="file"
          accept=".zip,application/zip"
          aria-label={T.fileLabel}
          onChange={(event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            // The same file can be chosen again afterwards.
            input.value = "";
            if (file) void choose(file);
          }}
        />
      </div>
      <p class="card__text" role="status">
        {busy ?? (message?.tone === "ok" ? message.lines[0] : "")}
      </p>
      {message?.tone === "ok" &&
        message.lines.slice(1).map((line) => (
          <p class="card__text" key={line}>
            {line}
          </p>
        ))}
      {message?.tone === "error" &&
        message.lines.map((line) => (
          <p class="card__text backup__error" role="alert" key={line}>
            {line}
          </p>
        ))}
      {pending && (
        <Sheet
          id="import"
          title={T.sheet.title}
          closeLabel={T.sheet.close}
          onClose={() => setPending(undefined)}
          footer={(close) => (
            <>
              <button
                class="button button--primary pressable"
                type="button"
                onClick={() => {
                  close();
                  void replace(pending);
                }}
              >
                {T.sheet.confirm}
              </button>
              <button class="button button--secondary pressable" type="button" onClick={close}>
                {T.sheet.cancel}
              </button>
            </>
          )}
        >
          <p class="note">
            <strong>{T.sheet.from(formatDateTime(pending.backup.summary.exportedAt))}</strong>
            {": "}
            {summaryText(pending.backup.summary)}
          </p>
          <p class="note">{T.sheet.replaces}</p>
          <Rows rows={rows(pending.backup.summary)} />
          <p class="note">{T.sheet.safety}</p>
          <p class="note">{T.sheet.prices}</p>
        </Sheet>
      )}
    </section>
  );
}
