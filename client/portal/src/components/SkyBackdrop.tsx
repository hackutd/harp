import sky from "@/assets/sky.webp";

/**
 * The sign-in page's night sky, shared with every full-screen loading and
 * error state so they all open onto the same scene. The art is portrait and
 * fades to black below the stars, so it is pinned to the top and the parent's
 * `bg-black` carries on underneath at any height. Mirrored so the moon sits on
 * the left.
 *
 * Absolutely positioned at `-z-10`: the parent needs `relative isolate`.
 */
export function SkyBackdrop() {
  return (
    <>
      <img
        src={sky}
        alt=""
        aria-hidden
        className="absolute inset-0 -z-10 size-full -scale-x-100 object-cover object-[60%_0%]"
      />
      <div aria-hidden className="star-field -z-10">
        <span className="shooting-star" />
      </div>
      <div aria-hidden className="star-field star-field-reverse -z-10">
        <span className="shooting-star [--star-delay:7s] [--star-top:12%]" />
      </div>
    </>
  );
}
