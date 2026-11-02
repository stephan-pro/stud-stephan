import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { objectPosition } from "../../domain/photoFocus";
import type { CoverImage } from "../../domain/showcase";
import { tintIndex } from "../labels";
import { usePhotoUrl } from "../photos";
import { Icon } from "./Icon";
import { Scribbles } from "./Scribbles";

interface CoverProps {
  /** The picture; none shows the placeholder. */
  readonly image?: CoverImage | undefined;
  /** What the picture shows; empty where the text beside it already says it. */
  readonly alt: string;
  /** Colour of the placeholder stays the same for the same key. */
  readonly tintKey: string;
  /** The patterns of the placeholders need an id each. */
  readonly scribbleId: string;
  readonly variant: "tile" | "hero" | "small" | "thumb" | "banner";
  readonly children?: ComponentChildren;
  /** Called when the picture could not be loaded (e.g. the other site does not allow it). */
  readonly onBroken?: (() => void) | undefined;
}

/**
 * A photo, or the placeholder (DESIGN.md section 5: tint, scribbles and picture symbol) while there
 * is none, it is fetched, or it cannot be shown. Own photos come from the private storage through
 * a signed address (`Remote.signedUrl`), catalog images from their own address.
 */
export function Cover({
  image,
  alt,
  tintKey,
  scribbleId,
  variant,
  children,
  onBroken,
}: CoverProps) {
  const photoUrl = usePhotoUrl(image?.kind === "photo" ? image.path : undefined);
  const url = image?.kind === "catalog" ? image.url : photoUrl;
  const [broken, setBroken] = useState<string | undefined>();
  // A picture that failed once is not tried again until another one is shown here.
  useEffect(() => setBroken(undefined), [url]);
  const showImage = typeof url === "string" && broken !== url;

  return (
    <div
      class={`cover cover--${variant} cover--tint-${tintIndex(tintKey)}${
        showImage ? (image?.kind === "catalog" ? " cover--catalog" : " cover--photo") : ""
      }`}
    >
      {showImage ? (
        <img
          class="cover__image"
          style={
            image?.kind === "photo" && image.focus
              ? { objectPosition: objectPosition(image.focus) }
              : undefined
          }
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerpolicy="no-referrer"
          onError={() => {
            setBroken(url);
            onBroken?.();
          }}
        />
      ) : (
        <>
          <Scribbles id={scribbleId} />
          <span class="cover__symbol">
            <Icon name="image" size={variant === "small" ? 20 : 30} strokeWidth={1.6} />
          </span>
        </>
      )}
      {children}
    </div>
  );
}
