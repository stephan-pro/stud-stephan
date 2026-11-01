/**
 * An id that `url(#…)` can use: only letters, digits, "_" and "-". Keys such as
 * "tile-minifig:lego:name:commander appo" have spaces and colons; a changed id also gets a short
 * hash of the original, so two keys that differ only in such characters stay different.
 */
export function patternId(raw: string): string {
  const clean = raw.replace(/[^A-Za-z0-9_-]/g, "-");
  if (clean === raw) return raw;
  let hash = 5381;
  for (const char of raw) hash = (hash * 33 + (char.codePointAt(0) ?? 0)) >>> 0;
  return `${clean}-${hash.toString(36)}`;
}

/**
 * White diagonal scribble lines over a coloured area (DESIGN.md section 5), as on the sign-in page
 * of the click dummy: one line every 90 px, rising at about 60°. A pattern, so it fills an area of
 * any size; the colour comes from CSS (`color: var(--scribble)`).
 */
export function Scribbles({ id: rawId }: { readonly id: string }) {
  const id = patternId(rawId);
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
