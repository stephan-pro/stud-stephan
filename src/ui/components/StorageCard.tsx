import { useEffect, useState } from "preact/hooks";
import type { Remote } from "../../backend/remote";
import { STORAGE_LIMIT_BYTES } from "../../backend/rules";
import { formatBytes } from "../../files/bytes";
import { TEXTS } from "../texts";

/** `undefined` while loading, a number when read, `null` when reading failed. */
type Usage = number | null | undefined;

/** S12: what photos and Studio files take of the free storage (used / 1 GB). */
export function StorageCard({ remote }: { readonly remote: Pick<Remote, "storageUsage"> }) {
  const T = TEXTS.storage;
  const [usage, setUsage] = useState<Usage>(undefined);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setUsage(undefined);
    remote.storageUsage().then(
      (bytes) => active && setUsage(bytes),
      () => active && setUsage(null),
    );
    return () => {
      active = false;
    };
  }, [remote, attempt]);

  return (
    <section class="card storage" aria-labelledby="storage-title">
      <h2 class="card__title" id="storage-title">
        {T.title}
      </h2>
      {usage === undefined && <p class="card__text">{T.loading}</p>}
      {usage === null && (
        <>
          <p class="card__text" role="alert">
            {T.failed}
          </p>
          <button
            class="button button--secondary pressable"
            type="button"
            onClick={() => setAttempt(attempt + 1)}
          >
            {T.retry}
          </button>
        </>
      )}
      {typeof usage === "number" && (
        <>
          <progress
            class="storage__bar"
            aria-label={T.meter}
            max={STORAGE_LIMIT_BYTES}
            value={Math.min(usage, STORAGE_LIMIT_BYTES)}
          />
          <p class="card__text">{T.used(formatBytes(usage), formatBytes(STORAGE_LIMIT_BYTES))}</p>
        </>
      )}
    </section>
  );
}
