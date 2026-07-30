-- The listing details a shop asks for and a manuscript does not: ISBN,
-- language, publisher, blurb, categories, series. See src/lib/publishing.ts.
--
-- jsonb for the same reason page and typography are: the shape belongs to its
-- own module and will grow as more shops are supported, and none of that should
-- be a migration. Nullable, because most books are never published -- and an
-- empty object is dropped client-side rather than stored, so null here means
-- "nobody has started" rather than "started and cleared".
--
-- NOTE: sync.ts sends this column on every book push, so until this has run,
-- PostgREST rejects the whole row (PGRST204) and *no* book syncs at all.
alter table public.books
  add column if not exists publishing jsonb;

comment on column public.books.publishing is
  'Store listing metadata (PublishingMeta in src/lib/publishing.ts). Null until a writer sets out to publish.';
