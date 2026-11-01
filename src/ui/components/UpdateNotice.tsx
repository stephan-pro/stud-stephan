import { useEffect, useState } from "preact/hooks";
import { applyUpdate, onUpdateWaiting, updateWaiting } from "../../pwa/register";
import { TEXTS } from "../texts";

/**
 * "Neue Version verfügbar – Neu laden" (P15) at the top of the screen, as soon as a new version of
 * the app is installed. It never reloads by itself, so nothing half typed gets lost.
 */
export function UpdateNotice() {
  const [waiting, setWaiting] = useState(updateWaiting);
  useEffect(() => onUpdateWaiting(() => setWaiting(true)), []);
  if (!waiting) return null;
  return (
    <div class="toast toast--top" role="status">
      <span class="toast__text">{TEXTS.update.message}</span>
      <button type="button" class="toast__action pressable" onClick={applyUpdate}>
        {TEXTS.update.action}
      </button>
    </div>
  );
}
