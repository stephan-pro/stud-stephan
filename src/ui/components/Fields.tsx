import type { ComponentChildren } from "preact";

/** The id the page gives the input of a field; the first wrong field gets the focus by it. */
export function fieldId(prefix: string, key: string): string {
  return `${prefix}-${key}`;
}

interface TextFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onInput: (value: string) => void;
  /** The message when the field is wrong; it also marks the field (`aria-invalid`). */
  readonly error?: string | undefined;
  readonly hint?: string | undefined;
  readonly placeholder?: string;
  readonly inputMode?: "text" | "decimal" | "numeric" | "url";
  readonly autoComplete?: string;
  /** More than one line (a note, a list of links). */
  readonly rows?: number;
  readonly optional?: string;
  /** Filled from the catalog: highlighted (and said so to screen readers) until it is changed. */
  readonly prefilled?: string | undefined;
}

/** A label, the input and, below it, the hint and the error: all tied together for screen readers. */
export function TextField({
  id,
  label,
  value,
  onInput,
  error,
  hint,
  placeholder,
  inputMode,
  autoComplete = "off",
  rows,
  optional,
  prefilled,
}: TextFieldProps) {
  const describedBy = [
    hint ? `${id}-hint` : undefined,
    prefilled ? `${id}-prefilled` : undefined,
    error ? `${id}-error` : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  const shared = {
    id,
    value,
    placeholder,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy || undefined,
    autoComplete,
  };
  return (
    <div class="field">
      <label class="field__label" for={id}>
        {label}
        {optional && <span class="field__optional"> ({optional})</span>}
      </label>
      {rows ? (
        <textarea
          {...shared}
          class={`field__input field__input--area${prefilled ? " field__input--prefilled" : ""}`}
          rows={rows}
          onInput={(event) => onInput(event.currentTarget.value)}
        />
      ) : (
        <input
          {...shared}
          class={`field__input${prefilled ? " field__input--prefilled" : ""}`}
          type="text"
          inputMode={inputMode}
          onInput={(event) => onInput(event.currentTarget.value)}
        />
      )}
      {prefilled && (
        <span class="visually-hidden" id={`${id}-prefilled`}>
          {prefilled}
        </span>
      )}
      {hint && (
        <p class="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p class="field__error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

interface ChoiceProps<T extends string> {
  readonly legend: string;
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly value: T | "";
  readonly onChange: (value: T) => void;
  /** Two choices as one pill (condition), else single chips. */
  readonly segmented?: boolean;
  readonly error?: string | undefined;
  readonly id?: string;
  /** The legend is the title of a card already. */
  readonly hideLegend?: boolean;
}

/** One out of a few: buttons that say which is chosen (`aria-pressed`), in a named group. */
export function Choice<T extends string>({
  legend,
  options,
  value,
  onChange,
  segmented = false,
  error,
  id,
  hideLegend = false,
}: ChoiceProps<T>) {
  return (
    <fieldset class="choice" id={id} aria-describedby={error && id ? `${id}-error` : undefined}>
      <legend class={hideLegend ? "visually-hidden" : "field__label"}>{legend}</legend>
      <div class={segmented ? "segmented" : "chips"}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            class={segmented ? "segmented__option pressable" : "chip pressable"}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {error && (
        <p class="field__error" id={id ? `${id}-error` : undefined}>
          {error}
        </p>
      )}
    </fieldset>
  );
}

/** A white card of a form with its title in handwriting and, at the right, an optional badge. */
export function FormCard({
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
    <section class="card form-card" aria-labelledby={`${id}-title`}>
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
