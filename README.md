# Cantonese Learning — Standalone Edition

This folder is a static, independent version of the Cantonese learning site.

- No ChatGPT login or OpenAI site runtime is required.
- Vocabulary, audio, quizzes, characters, and local challenges run directly from this folder.
- Learning records are stored locally in each learner's browser.

## Deploy

Upload this whole folder to any static host, such as Cloudflare Pages, Netlify, or GitHub Pages. The entry page is `index.html`.

For Cloudflare Pages, create a project from a Git repository and set the build output folder to this folder, with no build command.

## Next upgrade

To let learners sign in and retain progress across devices, connect Supabase or Firebase later. The current standalone edition intentionally has no account or central database dependency.
