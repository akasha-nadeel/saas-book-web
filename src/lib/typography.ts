/**
 * Body-text typography — the choices a printed novel makes about its type.
 *
 * Kept apart from storage and from React, like page-setup: a table of faces and
 * a little arithmetic that turns points and inches into the pixels the manuscript
 * is set in. The defaults are the trade recommendation for a 6×9 novel; a writer
 * can change any of them per book.
 *
 * The values reach the page as CSS custom properties (`--ms-*`) set on the
 * manuscript container, which the editor and the reading view both consume — so
 * one choice styles the writing surface, the read-through and the page-break
 * measurement together.
 */

export interface FontOption {
  id: string;
  label: string;
  /** A real stack, so an uninstalled face falls back to a book serif rather than
   *  to the browser default. */
  stack: string;
}

export const FONTS: readonly FontOption[] = [
  {
    id: "garamond",
    label: "Garamond",
    stack: 'Garamond, "EB Garamond", "Adobe Garamond Pro", Georgia, serif',
  },
  {
    id: "georgia",
    label: "Georgia",
    stack: 'Georgia, Cambria, "Times New Roman", serif',
  },
  {
    id: "baskerville",
    label: "Baskerville",
    stack:
      'Baskerville, "Baskerville Old Face", "Libre Baskerville", Georgia, serif',
  },
  {
    id: "times",
    label: "Times",
    stack: '"Times New Roman", Times, serif',
  },
  {
    id: "palatino",
    label: "Palatino",
    stack: '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
  },
  {
    id: "fraunces",
    label: "Fraunces",
    stack: "var(--font-fraunces), ui-serif, Georgia, serif",
  },
];

export function fontStack(id: string): string {
  return (FONTS.find((f) => f.id === id) ?? FONTS[0]).stack;
}

export interface Typography {
  /** A font id from FONTS. */
  font: string;
  /** Body size in points, as print type is measured. */
  sizePt: number;
  /** Line height as a multiple of the size. */
  leading: number;
  align: "justify" | "left";
  /** First-line indent, in inches. */
  indentIn: number;
  /** Space after each paragraph, in points. Novels use none. */
  paraSpacingPt: number;
}

export const DEFAULT_TYPOGRAPHY: Typography = {
  font: "garamond",
  sizePt: 12,
  leading: 1.4,
  align: "justify",
  indentIn: 0.25,
  paraSpacingPt: 0,
};

// The choices offered in the menu, so the control and the model never drift.
export const TEXT_SIZES: readonly number[] = [10.5, 11, 11.5, 12, 12.5, 13, 14];

export const LEADINGS: readonly { value: number; label: string }[] = [
  { value: 1.3, label: "1.3" },
  { value: 1.4, label: "1.4" },
  { value: 1.45, label: "1.45" },
  { value: 1.6, label: "1.6" },
  { value: 2, label: "Double" },
];

export const INDENTS: readonly { value: number; label: string }[] = [
  { value: 0, label: "None" },
  { value: 0.2, label: "0.2″" },
  { value: 0.25, label: "0.25″" },
  { value: 0.3, label: "0.3″" },
  { value: 0.5, label: "0.5″" },
];

export const PARA_SPACINGS: readonly { value: number; label: string }[] = [
  { value: 0, label: "None" },
  { value: 4, label: "4 pt" },
  { value: 8, label: "8 pt" },
];

const PT_TO_PX = 96 / 72;
const IN_TO_PX = 96;

/**
 * The manuscript CSS variables for a typography. Points and inches become the
 * pixels the pages are laid out in (96 to the inch), so the editor's print
 * layout is set at the true printed size.
 */
export function typographyVars(t: Typography): Record<string, string> {
  return {
    "--ms-font": fontStack(t.font),
    "--ms-size": `${(t.sizePt * PT_TO_PX).toFixed(2)}px`,
    "--ms-leading": String(t.leading),
    "--ms-align": t.align,
    "--ms-indent": `${(t.indentIn * IN_TO_PX).toFixed(2)}px`,
    "--ms-para-gap": `${(t.paraSpacingPt * PT_TO_PX).toFixed(2)}px`,
  };
}
