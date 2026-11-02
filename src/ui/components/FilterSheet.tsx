import { useMemo } from "preact/hooks";
import {
  type ShowcaseFilter,
  type ShowcaseSort,
  showcase,
  showcaseItems,
  showcaseThemes,
} from "../../domain/showcase";
import type { Collection, Condition, ManufacturerKind } from "../../domain/types";
import { TEXTS } from "../texts";
import { Sheet } from "./Sheet";

const MANUFACTURERS: readonly ManufacturerKind[] = ["lego", "bluebrixx", "other", "custom"];
const CONDITIONS: readonly Condition[] = ["new", "used"];
const MODIFIED: readonly ShowcaseFilter["modified"][] = ["any", "yes", "no"];

/** Adds the value to the list, or takes it out when it is in already. */
function toggled<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

function ToggleChip({
  pressed,
  onClick,
  children,
  small = false,
}: {
  readonly pressed: boolean;
  readonly onClick: () => void;
  readonly children: string;
  readonly small?: boolean;
}) {
  return (
    <button
      type="button"
      class={small ? "chip chip--small pressable" : "chip pressable"}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

interface FilterSheetProps {
  readonly collection: Collection;
  readonly filter: ShowcaseFilter;
  readonly sort: ShowcaseSort;
  readonly onChange: (filter: ShowcaseFilter) => void;
  readonly onClose: () => void;
}

/**
 * S1a: theme (two levels), maker, condition, modified and "nicht ausgestellt". Every change applies at
 * once, and the button at the bottom says how many tiles that leaves.
 */
export function FilterSheet({ collection, filter, sort, onChange, onClose }: FilterSheetProps) {
  const T = TEXTS.filter;
  const themes = useMemo(() => showcaseThemes(showcaseItems(collection)), [collection]);
  const count = useMemo(
    () => showcase(collection, filter, sort).length,
    [collection, filter, sort],
  );
  const set = (fields: Partial<ShowcaseFilter>) => onChange({ ...filter, ...fields });
  const themeChip = (theme: string, label: string, small = false) => (
    <ToggleChip
      key={theme}
      small={small}
      pressed={filter.themes.includes(theme)}
      onClick={() => set({ themes: toggled(filter.themes, theme) })}
    >
      {label}
    </ToggleChip>
  );

  return (
    <Sheet
      id="filter"
      title={T.title}
      closeLabel={T.close}
      onClose={onClose}
      footer={(close) => (
        <>
          <button
            type="button"
            class="button button--secondary pressable"
            onClick={() =>
              set({
                themes: [],
                manufacturers: [],
                conditions: [],
                modified: "any",
                notOnDisplay: false,
              })
            }
          >
            {T.reset}
          </button>
          <button type="button" class="button button--primary pressable" onClick={close}>
            {TEXTS.filter.show(count)}
          </button>
        </>
      )}
    >
      {themes.length > 0 && (
        <fieldset class="filter-group">
          <legend class="filter-group__title">{T.theme}</legend>
          <div class="chips">{themes.map((group) => themeChip(group.theme, group.theme))}</div>
          {themes
            .filter(
              (group) =>
                group.subThemes.length > 0 &&
                // A sub theme that is chosen stays visible even if its main theme is not.
                (filter.themes.includes(group.theme) ||
                  group.subThemes.some((sub) => filter.themes.includes(sub.theme))),
            )
            .map((group) => (
              <fieldset key={group.theme} class="chips filter-theme__subs">
                <legend class="visually-hidden">{group.theme}</legend>
                {group.subThemes.map((sub) => themeChip(sub.theme, sub.name, true))}
              </fieldset>
            ))}
        </fieldset>
      )}
      <fieldset class="filter-group">
        <legend class="filter-group__title">{T.manufacturer}</legend>
        <div class="chips">
          {MANUFACTURERS.map((kind) => (
            <ToggleChip
              key={kind}
              pressed={filter.manufacturers.includes(kind)}
              onClick={() => set({ manufacturers: toggled(filter.manufacturers, kind) })}
            >
              {T.manufacturers[kind]}
            </ToggleChip>
          ))}
        </div>
      </fieldset>
      <fieldset class="filter-group">
        <legend class="filter-group__title">{T.condition}</legend>
        <div class="chips">
          {CONDITIONS.map((condition) => (
            <ToggleChip
              key={condition}
              pressed={filter.conditions.includes(condition)}
              onClick={() => set({ conditions: toggled(filter.conditions, condition) })}
            >
              {TEXTS.conditions[condition]}
            </ToggleChip>
          ))}
        </div>
      </fieldset>
      <fieldset class="filter-group">
        <legend class="filter-group__title">{T.modified}</legend>
        <div class="chips">
          {MODIFIED.map((option) => (
            <ToggleChip
              key={option}
              pressed={filter.modified === option}
              onClick={() => set({ modified: option })}
            >
              {T.modifiedOptions[option]}
            </ToggleChip>
          ))}
        </div>
      </fieldset>
      <div class="chips">
        <ToggleChip
          pressed={filter.notOnDisplay}
          onClick={() => set({ notOnDisplay: !filter.notOnDisplay })}
        >
          {T.notOnDisplay}
        </ToggleChip>
      </div>
    </Sheet>
  );
}
