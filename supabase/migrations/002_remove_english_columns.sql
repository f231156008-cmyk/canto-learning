begin;

alter table public.words
  drop column if exists meaning_en;

alter table public.examples
  drop column if exists translation_en;

commit;
