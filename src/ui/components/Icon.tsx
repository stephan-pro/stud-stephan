// Line symbols of the click dummy (24 × 24, stroke = text colour). No library: a handful of paths.

const PATHS = {
  showcase: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </>
  ),
  dioramas: (
    <>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  wishlist: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  dashboard: <path d="M5 20V11M12 20V5M19 20v-6" />,
  settings: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M5 21v-3a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v3" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps {
  readonly name: IconName;
  readonly size?: number;
  /** Thicker lines for the plus (as in the dummy). */
  readonly strokeWidth?: number;
}

/** A decorative symbol; the link or button around it carries the name. */
export function Icon({ name, size = 22, strokeWidth = 2 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={strokeWidth}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
