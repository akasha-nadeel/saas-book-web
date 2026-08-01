/**
 * The shape most novels share, in plain words, placed against a word count.
 *
 * Three separate research batches name the same wall:
 *
 *   "I always get writer's block at the midpoint of my story. Every time."
 *   "First 20,000 words fly by quick. Then I realize I have enough content to
 *    get to 30,000."
 *
 * A writer stuck at 30,000 of 80,000 does not need a theory of narrative. They
 * need somebody to say: *you are at the middle, and the middle is where the
 * thing that makes going back impossible usually happens.* So the beats here
 * are positioned as a share of the finished length, and the screen puts the
 * writer's own word count on that line.
 *
 * **The names are deliberately plain, and deliberately ours.** The famous beat
 * sheets are somebody's copyrighted framework, and their vocabulary is its own
 * barrier — the research complains directly that story-structure terminology is
 * bad and hard to learn. "The middle turn" says what it is. "The Dark Night of
 * the Soul" needs a book explaining it first.
 *
 * **This is a convention, not a rule**, and everything built on it must say so.
 * Excellent novels ignore every line below. What it is for is the writer who
 * has run out of road and cannot see why.
 */

export interface Beat {
  id: string;
  /** Where it usually falls, as a share of the finished book. */
  from: number;
  to: number;
  title: string;
  /** What happens, in the writer's language rather than a critic's. */
  what: string;
}

export const BEATS: Beat[] = [
  {
    id: "before",
    from: 0,
    to: 0.05,
    title: "The world before",
    what: "Who they are while nothing has gone wrong yet, and what they want badly enough to lose.",
  },
  {
    id: "break",
    from: 0.05,
    to: 0.12,
    title: "The thing that breaks it",
    what: "The event that makes the old life impossible. Late here and readers put the book down; this is the promise on the back cover arriving.",
  },
  {
    id: "refuse",
    from: 0.12,
    to: 0.2,
    title: "Refusing, then going anyway",
    what: "They try to carry on as before, and cannot. The moment they choose is the moment the story starts.",
  },
  {
    id: "newworld",
    from: 0.2,
    to: 0.3,
    title: "Learning the new rules",
    what: "Somewhere unfamiliar, literally or otherwise. The reader learns how this world works by watching them get it wrong.",
  },
  {
    id: "attempt",
    from: 0.3,
    to: 0.45,
    title: "The first real attempt",
    what: "They try to fix it the obvious way. It works badly, or not at all, and costs more than they expected.",
  },
  {
    id: "midpoint",
    from: 0.45,
    to: 0.55,
    title: "The middle turn",
    what: "Something is learned or lost that makes going back impossible. **This is where books stall**, and almost always because there is nothing here — the story is still the story it was at 20%, so there is nothing left to happen.",
  },
  {
    id: "pressure",
    from: 0.55,
    to: 0.7,
    title: "The pressure comes back",
    what: "Whatever is against them pushes hardest, and now it knows what they are doing.",
  },
  {
    id: "low",
    from: 0.7,
    to: 0.8,
    title: "The lowest point",
    what: "They lose the thing or the person that made the attempt possible. Everything they had at the start is gone.",
  },
  {
    id: "idea",
    from: 0.8,
    to: 0.9,
    title: "The last idea",
    what: "What they do with what the whole book has taught them. It is usually the thing they refused to do at 15%.",
  },
  {
    id: "confront",
    from: 0.9,
    to: 0.97,
    title: "The confrontation",
    what: "The scene the book was always going to end in.",
  },
  {
    id: "after",
    from: 0.97,
    to: 1,
    title: "After",
    what: "The world before, shown again, different. Short. Readers have finished by now and are only checking they were right.",
  },
];

/**
 * What differs by genre, where it genuinely differs.
 *
 * Short, and only where a difference is real and widely agreed. Padding this
 * out to cover every genre equally would mean inventing conventions to fill
 * the gaps, and a made-up rule is worse than an absent one — a genre with no
 * note here gets the spine above, which is the honest answer.
 */
export const GENRE_NOTES: Record<string, string> = {
  Romance:
    "Two people rather than one. The pair meet inside the first tenth, are forced together by the quarter mark, and the middle turn is usually the moment they are honest with each other. The lowest point is a separation, and readers expect the ending to be happy — that is the genre's contract, not a suggestion.",
  Mystery:
    "The body, or the theft, is on the first pages — before the world before, if necessary. Clues arrive on a schedule, the detective is wrong once around the middle turn, and everything the reader needs must be on the page before the confrontation.",
  Thriller:
    "The pressure never fully lifts, so the quieter beats are shorter than the spine suggests. The reader usually knows something the hero does not, which is where the tension comes from rather than from surprise.",
  Horror:
    "The world before is longer, because the ordinary has to be worth losing. What is wrong is glimpsed and disbelieved before it is seen, and the lowest point is where the rules of survival turn out to be wrong.",
  "Science fiction":
    "The new world's rules do more work here than in any other genre, and they must be established before they matter to the plot. A rule invented at 80% to solve the problem is the one thing readers of this genre will not forgive.",
  Fantasy:
    "As science fiction, and longer — a world costs words. What magic cannot do matters more than what it can, and the limits have to be known before the confrontation depends on them.",
  "Historical fiction":
    "The period is a character and gets the same introduction. The confrontation is bounded by what actually happened, which is a constraint to write towards rather than around.",
  "Young adult":
    "Shorter and faster: the thing that breaks it comes earlier, and the middle turn is usually about who the character is rather than what they will do. The adult world is present and unhelpful.",
  Memoir:
    "The shape holds but the events are fixed, so the work is deciding where to start and what to leave out. The middle turn is the moment you understood something, not the moment it happened.",
};

export interface BeatPlacement extends Beat {
  /** Where this beat starts, in words, for this book. */
  fromWords: number;
  toWords: number;
  /** The writer is somewhere inside this beat. */
  current: boolean;
  /** The writer has written past it. */
  passed: boolean;
}

/**
 * The beats in words rather than percentages, and where the writer is.
 *
 * Returns null with no target: every number here is a share of a finished
 * length, and without one there is nothing to take a share of. Guessing a
 * target — from the genre, say — would put a plausible number on screen that
 * the writer never agreed to, and then measure them against it.
 */
export function placeBeats(
  words: number,
  target: number | undefined,
): BeatPlacement[] | null {
  if (!target || target <= 0) return null;

  return BEATS.map((beat) => {
    const fromWords = Math.round(beat.from * target);
    const toWords = Math.round(beat.to * target);
    return {
      ...beat,
      fromWords,
      toWords,
      // The last beat owns everything past its start, so a writer who has
      // overrun the target is "in" the ending rather than nowhere at all.
      current:
        words >= fromWords && (words < toWords || beat.id === "after"),
      passed: words >= toWords && beat.id !== "after",
    };
  });
}

/**
 * A plain sentence about where they are, for the top of the screen.
 *
 * Deliberately not advice. It names the beat and its share of the book; what
 * to do about that is the writer's business, and the beats themselves say what
 * usually happens there.
 */
export function whereYouAre(
  placements: BeatPlacement[] | null,
  words: number,
): string | null {
  if (!placements) return null;
  const current = placements.find((b) => b.current);
  if (!current) return null;
  const share = Math.round(
    (words / placements[placements.length - 1].toWords) * 100,
  );
  return `${words.toLocaleString()} words — about ${share}% of the way, which usually falls in “${current.title}”.`;
}
