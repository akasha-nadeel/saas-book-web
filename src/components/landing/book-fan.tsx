import { BookCover } from "@/components/shelf/book-cover";

/**
 * The fan of books over the hero, and its assembly on load.
 *
 * Each book is three nested elements because three transforms have to coexist
 * and one element can only hold one `transform` at a time:
 *
 *   placement — where it lands in the fan, and its tilt. Static.
 *   .oc-fly-in — the entry, once, staggered by index.
 *   .oc-book-lift — the hover, lifting one book clear of its neighbours.
 *
 * The entry animates *to* `transform: none`, which resolves against the
 * placement wrapper — so a book flies in and settles at whatever angle the fan
 * gave it, without the keyframes needing to know that angle.
 *
 * Decorative: no text here is worth reading out, so the whole thing is hidden
 * from assistive technology rather than announced as a list of fake titles.
 */
export function BookFan() {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto h-[16rem] w-full max-w-6xl select-none sm:h-[21.5rem]"
      // Perspective on the container, not the books, so they share one vanishing
      // point and read as a single arrangement in space rather than six
      // separately-skewed rectangles.
      style={{ perspective: "1400px" }}
    >
      {BOOKS.map((book, i) => (
        <div
          key={book.title}
          className="oc-book-slot absolute"
          style={{
            left: book.left,
            top: book.top,
            zIndex: i,
            transform: `rotate(${book.rot}deg) rotateY(${book.tiltY}deg) scale(${book.scale})`,
            transformOrigin: "center",
          }}
        >
          <div
            className="oc-fly-in"
            style={
              {
                animationDelay: `${120 + i * 110}ms`,
                "--fly-x": book.flyX,
                "--fly-y": book.flyY,
                "--fly-rot": `${book.flyRot}deg`,
              } as React.CSSProperties
            }
          >
            {/* The lift lives on its own element so it composes with the
                placement rotation above and the entry animation between —
                three transforms, three elements, as before. */}
            <div className="oc-book-lift">
              <Book
                title={book.title}
                author={book.author}
                words={book.words}
                cover={book.cover}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * One book, sized for the fan.
 *
 * The face itself is the shelf's own BookCover, not a copy of it. That is where
 * the spine fold, the page-block of hairlines and BOOK_SHADOW live, and a second
 * implementation here would drift from the app it is advertising — which is
 * exactly what a landing page must not do. All this adds is a width; BookCover
 * is aspect-[2/3] and sizes its own type in container units, so it comes out
 * right at any width it is given.
 */
function Book({
  title,
  author,
  words,
  cover,
}: {
  title: string;
  author: string;
  words: number;
  cover?: string;
}) {
  return (
    // 2:3, so the width sets the height: 11rem here is a 16.5rem book. Sized to
    // let the whole hero — headline, fan, sub, buttons — hold one screen.
    <div className="w-[8rem] sm:w-[11rem]">
      <BookCover
        title={title}
        author={author}
        words={words}
        image={cover}
        // The artwork carries its own title and byline, so the printed caption
        // is suppressed rather than doubled over it.
        bare
        // Seen nearly face-on at this tilt, the page block reads as a white bar
        // stuck to the edge instead of as leaves. Off here, on everywhere else.
        pageBlock={false}
        // The book's own cloth colour when it has no artwork, fixed by the
        // title so it never shifts between renders.
        seed={title}
      />
    </div>
  );
}

/**
 * Eight books on a symmetric arc, generated rather than eyeballed.
 *
 * Generated because every value has to stay in step with its mirror on the
 * other side or the fan visibly lists — so each field is a function of t, the
 * book's position from -1 at the left edge through 0 at the centre to +1 at
 * the right:
 *
 *   rot    t × 24°       splays outward along the tangent of the curve
 *   top    t² × 21%      a parabola, so the outer books hang lower
 *   scale  1 − t²×0.11   and sit slightly further back
 *   fly*   t × 6rem      they arrive from outside and gather inward
 *
 * The span (4% → 82%) is set against the container's max width rather than the
 * viewport, so consecutive books overlap by about a quarter on any monitor. Let
 * the container go full-bleed and the same percentages open into gaps on a wide
 * screen.
 *
 * `cover` names a file in /public/covers; without one a book falls back to the
 * cloth face BookCover draws. Nothing here reads the shelf — those covers live
 * in the writer's own localStorage, which a public page has no access to and
 * should not: it would be one person's library on everyone's landing page.
 */
const BOOKS: {
  title: string;
  author: string;
  words: number;
  cover?: string;
  left: string;
  top: string;
  rot: number;
  tiltY: number;
  scale: number;
  flyX: string;
  flyY: string;
  flyRot: number;
}[] = [
  {
    title: "Just for the Summer",
    author: "",
    words: 52000,
    cover: "/covers/cover-1.jpg",
    left: "4.00%",
    top: "21.00%",
    rot: -24,
    tiltY: 7,
    scale: 0.89,
    flyX: "-6.0rem",
    flyY: "7.0rem",
    flyRot: -30,
  },
  {
    title: "The Long Read",
    author: "",
    words: 38000,
    cover: "/covers/cover-2.jpg",
    left: "15.14%",
    top: "10.71%",
    rot: -17.1,
    tiltY: 5,
    scale: 0.944,
    flyX: "-4.3rem",
    flyY: "6.0rem",
    flyRot: -21.4,
  },
  {
    title: "Books and Bao",
    author: "",
    words: 61000,
    cover: "/covers/cover-3.jpg",
    left: "26.29%",
    top: "3.86%",
    rot: -10.3,
    tiltY: 3,
    scale: 0.98,
    flyX: "-2.6rem",
    flyY: "5.4rem",
    flyRot: -12.9,
  },
  {
    title: "Plot Twists",
    author: "",
    words: 73000,
    cover: "/covers/cover-5.jpg",
    left: "37.43%",
    top: "0.43%",
    rot: -3.4,
    tiltY: 1,
    scale: 0.998,
    flyX: "-0.9rem",
    flyY: "5.0rem",
    flyRot: -4.3,
  },
  {
    title: "A Duet for Home",
    author: "",
    words: 86000,
    cover: "/covers/cover-7.jpg",
    left: "48.57%",
    top: "0.43%",
    rot: 3.4,
    tiltY: -1,
    scale: 0.998,
    flyX: "0.9rem",
    flyY: "5.0rem",
    flyRot: 4.3,
  },
  {
    title: "Sherlock Holmes",
    author: "",
    words: 94000,
    cover: "/covers/cover-9.jpg",
    left: "59.71%",
    top: "3.86%",
    rot: 10.3,
    tiltY: -3,
    scale: 0.98,
    flyX: "2.6rem",
    flyY: "5.4rem",
    flyRot: 12.9,
  },
  {
    title: "Havenfall",
    author: "",
    words: 67000,
    cover: "/covers/cover-10.jpg",
    left: "70.86%",
    top: "10.71%",
    rot: 17.1,
    tiltY: -5,
    scale: 0.944,
    flyX: "4.3rem",
    flyY: "6.0rem",
    flyRot: 21.4,
  },
  {
    title: "Better Than the Movies",
    author: "",
    words: 58000,
    cover: "/covers/cover-12.jpg",
    left: "82.00%",
    top: "21.00%",
    rot: 24,
    tiltY: -7,
    scale: 0.89,
    flyX: "6.0rem",
    flyY: "7.0rem",
    flyRot: 30,
  },
];
