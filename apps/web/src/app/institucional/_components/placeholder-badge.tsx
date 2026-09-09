import { PLACEHOLDER } from "../_content/institucional-copy";

/**
 * Marks a section whose copy is still a draft.
 *
 * Deliberately loud. An invented number that looks like a real one is the one
 * mistake this page cannot make, and a quiet TODO in a comment does not survive
 * the day someone decides to publish. The block wrapper matters: the badge is
 * inline-flex so it hugs its text, and without it the badge would flow onto the
 * same line as the eyebrow below it. Flip `PLACEHOLDER` in the copy module and
 * every badge disappears at once.
 */
export function PlaceholderBadge({ children }: { children: string }) {
  if (!PLACEHOLDER) return null;

  return (
    <div className="mb-6">
      <p className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-300">
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-amber-400"
        />
        Texto provisório: {children}
      </p>
    </div>
  );
}
