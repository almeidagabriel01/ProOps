/**
 * The mobile app's product name, in ONE place.
 *
 * The app repository still calls itself "Personal ProOps app" and says in its
 * own CLAUDE.md that the name is provisional. Every string the landing page
 * shows reads from here, so naming it later is a one-line change instead of a
 * find-and-replace across copy, metadata and structured data.
 */
export const APP_NAME = "ProOps Pessoal";

/** Used where the sentence already says "ProOps", to avoid stuttering. */
export const APP_SHORT_NAME = "Pessoal";
