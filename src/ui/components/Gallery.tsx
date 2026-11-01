import { useState } from "preact/hooks";
import type { CoverImage } from "../../domain/showcase";
import { TEXTS } from "../texts";
import { Cover } from "./Cover";

interface GalleryProps {
  readonly images: readonly CoverImage[];
  readonly name: string;
  /** Identifies the object for the colour and the patterns of the placeholder. */
  readonly id: string;
}

/**
 * The photos of a detail page (S2): own photos in order, the catalog image last, swiped sideways.
 * Without any picture the placeholder stands in for one.
 */
export function Gallery({ images, name, id }: GalleryProps) {
  const T = TEXTS.detail;
  const [index, setIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div class="gallery">
        <Cover alt="" tintKey={id} scribbleId={`hero-${id}`} variant="hero" />
      </div>
    );
  }
  return (
    <div class="gallery">
      <section
        class="gallery__track"
        aria-label={`${T.gallery}: ${name}`}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling area must be reachable with the keyboard (arrow keys), WCAG 2.1.1
        tabIndex={0}
        onScroll={(event) => {
          const track = event.currentTarget;
          setIndex(Math.round(track.scrollLeft / Math.max(track.clientWidth, 1)));
        }}
      >
        {images.map((image, position) => (
          <div key={image.kind === "photo" ? image.path : image.url} class="gallery__slide">
            <Cover
              image={image}
              alt={
                image.kind === "photo"
                  ? T.photoAlt(name, position + 1, images.length)
                  : T.catalogAlt(name)
              }
              tintKey={id}
              scribbleId={`hero-${id}-${position}`}
              variant="hero"
            />
          </div>
        ))}
      </section>
      {images.length > 1 && (
        <span class="gallery__counter">{T.photoCounter(index + 1, images.length)}</span>
      )}
    </div>
  );
}
