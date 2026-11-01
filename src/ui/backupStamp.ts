import { parseBackupDay } from "../domain/backupReminder";
import type { IsoDate } from "../domain/types";

const KEY = "stud-stephan:last-backup";

/** The day of the last backup made on this device (a backup file lives on the device, too). */
export interface BackupStamp {
  read(): IsoDate | undefined;
  write(day: IsoDate): void;
}

/** Kept in the browser's storage; if that is not available, there is simply no reminder state. */
export const deviceStamp: BackupStamp = {
  read() {
    try {
      return parseBackupDay(localStorage.getItem(KEY));
    } catch {
      return undefined;
    }
  },
  write(day) {
    try {
      localStorage.setItem(KEY, day);
    } catch {
      // Private window or blocked storage: the next visit asks for a backup again, nothing else.
    }
  },
};
