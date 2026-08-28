# 用这个项目学习 SQL

网站仍可直接读取 `data/words.json`，因此没有网络或数据库尚未配置时也能学习。Supabase（PostgreSQL）接入后，SQL 负责在线词库、账号、跨设备进度和答题记录。

## 数据之间的关系

- `themes`：主题，例如「交通」「饮食」。
- `words`：词条；每个词属于一个主题，并带难度和发音文件名。
- `examples`：例句；一个词可以有多条例句。
- `tags` / `word_tags`：一个词可以拥有多个标签。
- `user_progress`：每位用户对每个词的学习状态。
- `quiz_attempts`：每次答题的历史记录，供复习算法和统计使用。

## 第一次建立数据库

1. 新建 Supabase 项目。
2. 在 SQL Editor 执行 `supabase/migrations/001_initial_schema.sql`。
3. 在项目根目录运行 `powershell -File tools/words-to-sql.ps1`。
4. 在 SQL Editor 执行生成的 `supabase/seed.sql`。

`seed.sql` 可以重复执行：现有词条会更新，不会因再次导入而重复。

## 以后怎样扩词

短期仍可在表格或 `data/words.json` 编辑，再重新生成并导入 `seed.sql`。接入管理后台后，可直接在网页中增删词条；网站同时提供 JSON 导出，确保本地和 GitHub 始终有一份可读备份。

## 几条能看懂项目的 SQL

按主题和难度查看词汇：

```sql
select w.word, w.jyutping, t.name as theme, w.difficulty
from public.words w
join public.themes t on t.id = w.theme_id
where t.name = '交通' and w.difficulty = 1
order by w.id;
```

查看需要复习的词：

```sql
select w.word, w.jyutping, p.next_review_at
from public.user_progress p
join public.words w on w.id = p.word_id
where p.user_id = auth.uid()
  and p.next_review_at <= now()
order by p.next_review_at;
```

统计最近答错最多的词：

```sql
select w.word, count(*) as wrong_times
from public.quiz_attempts a
join public.words w on w.id = a.word_id
where a.user_id = auth.uid() and not a.is_correct
group by w.id, w.word
order by wrong_times desc
limit 20;
```

