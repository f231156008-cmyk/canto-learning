-- Minimum Data API privileges for the public vocabulary and signed-in learner data.
grant usage on schema public to anon, authenticated;

grant select on public.themes, public.words, public.examples, public.tags, public.word_tags
  to anon, authenticated;

grant select, insert, update, delete on public.user_progress
  to authenticated;

grant select, insert on public.quiz_attempts
  to authenticated;

grant usage, select on all sequences in schema public
  to authenticated;
