create table if not exists public.library_entries (
    id uuid primary key default gen_random_uuid(),
    entry_type text not null check (entry_type in ('歌词', '书籍', '电影对白', '原创')),
    title text,
    creator text,
    excerpt text not null,
    language text not null default '粤语',
    rights_status text not null default '待确认' check (rights_status in ('原创', '已授权', '公有领域', '待确认')),
    featured_on date,
    is_published boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.library_entries enable row level security;

create policy "Published library entries are readable"
on public.library_entries for select
to anon, authenticated
using (is_published = true);

grant select on public.library_entries to anon, authenticated;

insert into public.library_entries (entry_type, title, creator, excerpt, rights_status, featured_on, is_published)
values ('原创', '城市札记', '粤语学习网', '城市的声音，留在每一个学会开口的人身上。', '原创', current_date, true);
