/**
 * A word this book writes two ways, with neither of them wrong.
 *
 * **Generated — do not hand-edit.** `scripts/build-word-tables.cjs` builds it
 * from a hand-written seed list plus AGID's inflections; the seeds and the
 * argument for each refusal live in that script, because which pairs are
 * *variants* and which are *different words* is judgement rather than data.
 *
 * This is not a dialect question. `colour/color` is British against American
 * and belongs in `spelling-pairs.ts`; `e-mail/email` is a decision a book makes
 * once and then has to keep — the kind of thing a copy editor writes on a style
 * sheet at the start and holds the manuscript to.
 *
 * ## Why AGID is here
 *
 * The seeds are base forms, and a book does not write base forms. Seventeen
 * hand-typed pairs found `e-mail` against `email` and were blind to `e-mails`,
 * `e-mailed` and `e-mailing`. AGID inflects the closed form and the same suffix
 * is applied to the other side.
 *
 * **Only pairs differing by a hyphen or a space are inflected.** For those the
 * transformation is unambiguous. For `sneaked/snuck` there is no such rule, and
 * guessing would put words in this table that nobody writes.
 */
export const STYLE_PAIRS: readonly (readonly [string, string])[] = [
  ["all right", "alright"],
  ["amidst", "amid"],
  ["backwards", "backward"],
  ["cell phone", "cellphone"],
  ["cell phones", "cellphones"],
  ["co-author", "coauthor"],
  ["co-authored", "coauthored"],
  ["co-authoring", "coauthoring"],
  ["co-authors", "coauthors"],
  ["co-operate", "cooperate"],
  ["co-operated", "cooperated"],
  ["co-operates", "cooperates"],
  ["co-ordinate", "coordinate"],
  ["co-ordinated", "coordinated"],
  ["co-ordinates", "coordinates"],
  ["co-worker", "coworker"],
  ["co-workers", "coworkers"],
  ["data base", "database"],
  ["data based", "databased"],
  ["data bases", "databases"],
  ["dived", "dove"],
  ["doughnut", "donut"],
  ["downwards", "downward"],
  ["e-mail", "email"],
  ["e-mailed", "emailed"],
  ["e-mailing", "emailing"],
  ["e-mails", "emails"],
  ["for ever", "forever"],
  ["for evers", "forevers"],
  ["forwards", "forward"],
  ["good night", "goodnight"],
  ["good-bye", "goodbye"],
  ["good-byes", "goodbyes"],
  ["health care", "healthcare"],
  ["health cares", "healthcares"],
  ["home page", "homepage"],
  ["home pages", "homepages"],
  ["life style", "lifestyle"],
  ["life styles", "lifestyles"],
  ["lighted", "lit"],
  ["none the less", "nonetheless"],
  ["okay", "ok"],
  ["on-line", "online"],
  ["on-liner", "onliner"],
  ["per cent", "percent"],
  ["per cents", "percents"],
  ["pleaded", "pled"],
  ["pre-empt", "preempt"],
  ["pre-empted", "preempted"],
  ["pre-empting", "preempting"],
  ["pre-empts", "preempts"],
  ["proved", "proven"],
  ["re-enter", "reenter"],
  ["re-entered", "reentered"],
  ["re-entering", "reentering"],
  ["re-enters", "reenters"],
  ["re-read", "reread"],
  ["re-reading", "rereading"],
  ["re-reads", "rereads"],
  ["sneaked", "snuck"],
  ["under way", "underway"],
  ["upwards", "upward"],
  ["web site", "website"],
  ["web sites", "websites"],
  ["worth while", "worthwhile"],
];
