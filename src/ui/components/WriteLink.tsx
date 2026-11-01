import type { ComponentChildren } from "preact";
import { TEXTS } from "../texts";
import { useWritable } from "../useCollection";

/**
 * A link to a page that changes something (edit, another copy, assign figures). Without a connection
 * (P15) it is a switched-off button that looks the same and says why.
 */
export function WriteLink({
  href,
  class: className,
  label,
  children,
}: {
  readonly href: string;
  readonly class: string;
  /** The name of an icon-only link. */
  readonly label?: string | undefined;
  readonly children: ComponentChildren;
}) {
  const writable = useWritable();
  if (writable) {
    return (
      <a class={className} href={href} aria-label={label}>
        {children}
      </a>
    );
  }
  return (
    <button
      type="button"
      class={className}
      disabled
      aria-label={label ? `${label} – ${TEXTS.readOnlyShort}` : undefined}
      title={TEXTS.readOnlyShort}
    >
      {children}
    </button>
  );
}

/** The note under a switched-off save button (P15); nothing while saving works. */
export function ReadOnlyNote() {
  const writable = useWritable();
  if (writable) return null;
  return (
    <p class="read-only-note" role="status">
      {TEXTS.readOnly}
    </p>
  );
}
