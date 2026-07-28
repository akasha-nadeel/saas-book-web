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

/**
 * How a new book is set.
 *
 * There are two ways to show where one paragraph ends and the next begins, and
 * using both at once is the one combination that is actually wrong: a first-line
 * indent, or a space between. Printed novels take the indent and no space, which
 * is what this used to do. A word processor takes the space and no indent, and
 * that is what a writer coming from Word recognises as a paragraph — so that is
 * what the book starts on now, and the Aa panel switches to the printed-novel
 * setting for anyone who wants the page to read as a book.
 *
 * Export is unaffected either way: an EPUB or PDF is set by its own template
 * (see lib/export/typeset.ts), which sets body text as a book regardless.
 */
export const DEFAULT_TYPOGRAPHY: Typography = {
  font: "garamond",
  sizePt: 12,
  leading: 1.4,
  align: "justify",
  indentIn: 0,
  paraSpacingPt: 8,
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

/**
 * How a paragraph is marked off from the one before it.
 *
 * This is one decision, and it was being asked as two questions. A reader needs
 * exactly one signal that a new paragraph has begun: a first line stepped in, or
 * a space above. Both together is the combination that looks wrong — the page
 * gains gaps it does not need and the openings stop meaning anything — and
 * neither leaves the prose in one undifferentiated block. Offering the indent
 * and the spacing as unrelated dropdowns let a book end up in either state
 * without ever choosing it.
 */
export type ParagraphStyle = "indented" | "spaced";

export const PARAGRAPH_STYLES: readonly {
  value: ParagraphStyle;
  label: string;
}[] = [
  { value: "spaced", label: "Spaced" },
  { value: "indented", label: "Indented" },
];

/** Which of the two a book is currently set to. The indent decides it: a book
 *  that steps its first lines in is an indented one, whatever else is set. */
export function paragraphStyleOf(t: Typography): ParagraphStyle {
  return t.indentIn > 0 ? "indented" : "spaced";
}

/** The pair of settings a style stands for, so the two can never disagree. */
export function paragraphStyleSettings(
  style: ParagraphStyle,
): Pick<Typography, "indentIn" | "paraSpacingPt"> {
  return style === "indented"
    ? // As a printed novel is set: the opening line stepped in, no space.
      { indentIn: 0.25, paraSpacingPt: 0 }
    : // As a word processor sets it: flush openings, a space between.
      { indentIn: 0, paraSpacingPt: 8 };
}

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
