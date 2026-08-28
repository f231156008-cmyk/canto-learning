param(
    [string]$InputPath = "data/words.json",
    [string]$OutputPath = "supabase/seed.sql"
)

$ErrorActionPreference = "Stop"
$words = Get-Content -LiteralPath $InputPath -Raw -Encoding UTF8 | ConvertFrom-Json

function SqlText($value) {
    if ($null -eq $value -or [string]::IsNullOrWhiteSpace([string]$value)) { return "null" }
    return "'" + ([string]$value).Replace("'", "''") + "'"
}

$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add("-- Generated from data/words.json. Re-run tools/words-to-sql.ps1 after editing the JSON file.")
$lines.Add("begin;")

$categories = $words | ForEach-Object { $_.category } | Sort-Object -Unique
for ($index = 0; $index -lt $categories.Count; $index++) {
    $name = $categories[$index]
    $slug = "theme-" + ($index + 1).ToString("00")
    $lines.Add("insert into public.themes (name, slug, sort_order) values ($(SqlText $name), $(SqlText $slug), $($index + 1)) on conflict (name) do update set sort_order = excluded.sort_order;")
}

foreach ($item in $words) {
    $female = if ($item.audio) { $item.audio.female } else { $null }
    $male = if ($item.audio) { $item.audio.male } else { $null }
    $audioStatus = if ($item.audioStatus) { $item.audioStatus } else { "unreviewed" }
    $lines.Add("insert into public.words (legacy_id, theme_id, word, jyutping, difficulty, level, meaning_zh, meaning_en, pronunciation_note, audio_status, audio_review_note, audio_female, audio_male) select $($item.id), id, $(SqlText $item.word), $(SqlText $item.jyutping), $($item.difficulty), $(SqlText $item.level), $(SqlText $item.meaning), $(SqlText $item.english), $(SqlText $item.pronunciationNote), $(SqlText $audioStatus), $(SqlText $item.audioReviewNote), $(SqlText $female), $(SqlText $male) from public.themes where name = $(SqlText $item.category) on conflict (legacy_id) do update set theme_id = excluded.theme_id, word = excluded.word, jyutping = excluded.jyutping, difficulty = excluded.difficulty, level = excluded.level, meaning_zh = excluded.meaning_zh, meaning_en = excluded.meaning_en, pronunciation_note = excluded.pronunciation_note, audio_status = excluded.audio_status, audio_review_note = excluded.audio_review_note, audio_female = excluded.audio_female, audio_male = excluded.audio_male, updated_at = now();")
    if (-not [string]::IsNullOrWhiteSpace([string]$item.example)) {
        $lines.Add("insert into public.examples (word_id, sentence, translation_zh, translation_en) select id, $(SqlText $item.example), $(SqlText $item.translation), $(SqlText $item.sentenceEnglish) from public.words where legacy_id = $($item.id) and not exists (select 1 from public.examples where examples.word_id = words.id and examples.sentence = $(SqlText $item.example));")
    }
}

$lines.Add("commit;")
$parent = Split-Path -Parent $OutputPath
if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
$lines | Set-Content -LiteralPath $OutputPath -Encoding UTF8
Write-Host "Generated $OutputPath from $($words.Count) words."
