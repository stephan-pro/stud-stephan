import type { ComponentChildren } from "preact";
import type { ShowcaseItem } from "../../domain/types";
import { linkLabel, safeUrl } from "../labels";
import { routeHash } from "../route";
import { TEXTS } from "../texts";
import { Icon } from "./Icon";

/** The row at the top of a detail page: back to the showcase. */
export function BackBar() {
  return (
    <header class="page-header">
      <a
        class="icon-button back-link pressable"
        href={routeHash("showcase")}
        aria-label={TEXTS.detail.back}
      >
        <Icon name="back" />
      </a>
    </header>
  );
}

/** A white card with a title in handwriting and, at the right, an optional badge. */
export function Section({
  id,
  title,
  badge,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly badge?: ComponentChildren;
  readonly children: ComponentChildren;
}) {
  return (
    <section class="card" aria-labelledby={`${id}-title`}>
      <div class="card__head">
        <h2 class="card__title" id={`${id}-title`}>
          {title}
        </h2>
        {badge}
      </div>
      {children}
    </section>
  );
}

/** Label and value in a list of rows. */
export function Rows({
  rows,
}: {
  readonly rows: readonly { label: string; value: ComponentChildren }[];
}) {
  return (
    <dl class="rows">
      {rows.map((row) => (
        <div key={row.label} class="rows__row">
          <dt class="rows__label">{row.label}</dt>
          <dd class="rows__value">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Notes and links of an object, the same on every detail page. */
export function NoteAndLinks({ item }: { readonly item: ShowcaseItem }) {
  const links = item.links.filter((link) => link.trim() !== "");
  return (
    <>
      {item.note && (
        <Section id="note" title={TEXTS.detail.note}>
          <p class="note">{item.note}</p>
        </Section>
      )}
      {links.length > 0 && (
        <Section id="links" title={TEXTS.detail.links}>
          <ul class="link-list">
            {links.map((link) => {
              const href = safeUrl(link);
              return (
                <li key={link}>
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      {linkLabel(link)}
                    </a>
                  ) : (
                    link
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </>
  );
}

/** Whether the page can say anything about the origin (a row without data is left out). */
export function originRows(
  rows: readonly { label: string; value: ComponentChildren | undefined }[],
): { label: string; value: ComponentChildren }[] {
  return rows.flatMap((row) =>
    row.value === undefined || row.value === "" ? [] : [{ label: row.label, value: row.value }],
  );
}
