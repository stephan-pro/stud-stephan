/**
 * White diagonal scribble lines over a coloured area (DESIGN.md section 5), as on the sign-in page
 * of the click dummy: one line every 90 px, rising at about 60°. A pattern, so it fills an area of
 * any size; the colour comes from CSS (`color: var(--scribble)`).
 */
export function Scribbles({ id }: { readonly id: string }) {
  return (
    <svg class="scribbles" aria-hidden="true" focusable="false">
      <defs>
        <pattern
          id={id}
          width="90"
          height="10"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(31)"
        >
          <path d="M45 -5V15" stroke="currentColor" stroke-width="6" stroke-linecap="round" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
