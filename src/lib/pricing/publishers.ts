/**
 * Which side of the trade a listing's publisher is on.
 *
 * **Sorted by the publisher's name and nothing else, and the screen says so.**
 * The table is the Big Five (Penguin Random House, HarperCollins, Simon &
 * Schuster, Macmillan, Hachette) with the imprints Apple's lists actually name,
 * plus the established houses that are not Big Five but are plainly not
 * self-publishing either (Kensington, Sourcebooks, Bloomsbury, Scholastic…).
 * Everything else is "self-published & small presses" — a writer's own LLC, a
 * distributor's name, a two-person press. A small press therefore sits with
 * the self-published, which is the right side of the line for a writer asking
 * what books like theirs charge.
 *
 * **Every pattern is anchored to the start of the name**, because imprints are
 * short words that turn up inside authors' names: `Harper` matches "Harper"
 * and "Harper Voyager" but not "Harper Sloan", and `MIRA` matches "MIRA Books"
 * but not "Mira Lyn Kelly". The test walks both sides.
 */

export type PublisherGroup = "traditional" | "independent";

export const GROUP_LABEL: Record<PublisherGroup, string> = {
  independent: "Self-published & small presses",
  traditional: "Traditional publishers",
};

const TRADITIONAL: readonly RegExp[] = [
  // Penguin Random House
  /^penguin\b/, /^random house\b/, /^knopf\b/, /^doubleday\b/, /^crown\b/,
  /^ballantine\b/, /^bantam\b/, /^del rey\b/, /^berkley\b/, /^putnam\b/,
  /^g\. ?p\. putnam/, /^dutton\b/, /^viking\b/, /^riverhead\b/, /^ace\b/,
  /^daw\b/, /^delacorte\b/, /^transworld\b/, /^hogarth\b/, /^anchor\b/,
  /^vintage\b/, /^pantheon\b/, /^philomel\b/, /^razorbill\b/, /^dial\b/,
  // HarperCollins, Harlequin included
  /^harper$/, /^harpercollins\b/, /^harperteen\b/,
  /^harper (voyager|perennial|paperbacks|teen|muse|design|business|one|wave|select|horizon|via|360)\b/,
  /^greenwillow\b/, /^balzer \+ bray\b/, /^katherine tegen\b/, /^quill tree\b/,
  /^william morrow\b/, /^avon\b/, /^ecco\b/, /^mariner\b/, /^mira( books)?$/,
  /^harlequin\b/, /^hqn\b/, /^carina press\b/, /^hanover square\b/, /^park row\b/,
  /^graydon house\b/, /^one more chapter\b/, /^clarion\b/, /^zondervan\b/,
  /^thomas nelson\b/,
  // Simon & Schuster
  /^simon & schuster\b/, /^s&s\b/, /^scribner\b/, /^gallery\b/,
  /^atria\b/, /^pocket books\b/, /^saga press\b/, /^mtv books\b/,
  /^avid reader\b/, /^threshold\b/, /^margaret k\. mcelderry\b/,
  /^atheneum\b/, /^aladdin\b/,
  // Macmillan
  /^st\.? martin/, /^thomas dunne\b/, /^tor\b/, /^minotaur\b/, /^flatiron\b/,
  /^celadon\b/,
  /^henry holt\b/, /^farrar\b/, /^macmillan\b/, /^pan macmillan\b/,
  /^picador\b/, /^wednesday books\b/, /^feiwel\b/, /^roaring brook\b/,
  // Hachette
  /^little, brown\b/, /^grand central\b/, /^orbit\b/, /^hachette\b/,
  /^redhook\b/, /^mulholland\b/, /^bookouture\b/, /^hodder\b/, /^quercus\b/,
  /^orion\b/, /^headline\b/, /^sphere\b/, /^piatkus\b/, /^gollancz\b/,
  /^algonquin\b/, /^running press\b/,
  // Established houses outside the Big Five
  /^kensington\b/, /^sourcebooks\b/, /^bloomsbury\b/, /^scholastic\b/,
  /^disney\b/, /^hyperion\b/, /^w\. ?w\. norton\b/, /^liveright\b/,
  /^grove (atlantic|press)\b/, /^atlantic monthly\b/, /^blackstone\b/,
  /^titan\b/, /^baen\b/, /^seven seas\b/, /^j-novel club\b/,
  /^open road media\b/, /^wizards of the coast\b/, /^spiegel & grau\b/,
  /^union square\b/, /^zando\b/, /^abrams\b/, /^amulet\b/, /^candlewick\b/,
  /^chronicle books\b/, /^crooked lane\b/, /^pegasus books\b/, /^soho\b/,
  /^ecw press\b/, /^planeta\b/,
  /* Two measured on the lists rather than known in advance (2026-10-05).
     Entangled publishes Fourth Wing and prices like a big house — $14.99,
     $14.99, $9.99 — and Storytide is HarperCollins' young-adult imprint
     ($12.99, $12.99, $11.99). Left as small presses, they pulled the
     self-published middle for epic fantasy up to $11.49. Boldwood, Tule and
     Bindery, which price at $0.99–$4.99, stay where they are. */
  /^entangled\b/, /^storytide\b/,
];

export function publisherGroup(
  publisher: string | null | undefined,
): PublisherGroup {
  if (!publisher) return "independent";
  const name = publisher.trim().toLowerCase().replace(/[’‘]/g, "'");
  return TRADITIONAL.some((pattern) => pattern.test(name))
    ? "traditional"
    : "independent";
}
