import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { Icon } from "./Icon";

interface SheetProps {
  readonly title: string;
  readonly closeLabel: string;
  readonly onClose: () => void;
  readonly children: ComponentChildren;
  /** Actions below the content; `close` closes the sheet and gives the focus back. */
  readonly footer?: (close: () => void) => ComponentChildren;
  readonly id: string;
}

/**
 * A dialog the page behind is blocked for (DESIGN.md section 6): a bottom sheet on the phone, a
 * panel at the right on the PC (CSS decides). The browser's own `<dialog>` brings the focus in, keeps
 * it inside, closes with Escape and puts it back where it was.
 */
export function Sheet({ title, closeLabel, onClose, children, footer, id }: SheetProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes a dialog natively; this click is only for the dimmed area beside it
    <dialog
      ref={dialog}
      class="sheet"
      aria-labelledby={`${id}-title`}
      onClose={onClose}
      onClick={(event) => {
        // A tap on the dimmed area beside the sheet lands on the dialog element itself.
        if (event.target === dialog.current) dialog.current?.close();
      }}
    >
      <div class="sheet__content">
        <div class="sheet__handle" aria-hidden="true" />
        <div class="sheet__header">
          <h2 class="card__title" id={`${id}-title`}>
            {title}
          </h2>
          <button
            type="button"
            class="icon-button pressable"
            aria-label={closeLabel}
            onClick={() => dialog.current?.close()}
          >
            <Icon name="close" />
          </button>
        </div>
        <div class="sheet__body">{children}</div>
        {footer && <div class="sheet__footer">{footer(() => dialog.current?.close())}</div>}
      </div>
    </dialog>
  );
}
