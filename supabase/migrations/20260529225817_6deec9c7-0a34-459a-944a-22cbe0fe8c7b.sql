
create extension if not exists vector;

-- Indexed docs (chunked)
create table public.roblox_docs (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('github','web')),
  source_url text not null,
  repo_path text,
  title text not null,
  section text,
  content text not null,
  token_count integer,
  sha text,
  model text not null default 'openai/text-embedding-3-small',
  embedding vector(1536) not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index roblox_docs_path_idx on public.roblox_docs(repo_path);
create index roblox_docs_source_idx on public.roblox_docs(source);
create index roblox_docs_embedding_idx
  on public.roblox_docs using hnsw (embedding vector_cosine_ops);

grant select on public.roblox_docs to authenticated;
grant all on public.roblox_docs to service_role;
alter table public.roblox_docs enable row level security;
create policy "auth read docs" on public.roblox_docs
  for select to authenticated using (true);

-- Sync run log
create table public.roblox_docs_sync (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  status text not null default 'running' check (status in ('running','completed','failed')),
  processed integer not null default 0,
  total integer not null default 0,
  skipped integer not null default 0,
  error text,
  started_by uuid,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
grant select on public.roblox_docs_sync to authenticated;
grant all on public.roblox_docs_sync to service_role;
alter table public.roblox_docs_sync enable row level security;
create policy "auth read sync" on public.roblox_docs_sync
  for select to authenticated using (true);

-- Similarity search
create or replace function public.match_roblox_docs(
  query_embedding vector(1536),
  match_count int default 6,
  min_similarity float default 0.55
) returns table (
  id uuid,
  source text,
  source_url text,
  repo_path text,
  title text,
  section text,
  content text,
  similarity float
) language sql stable security definer set search_path = public as $$
  select d.id, d.source, d.source_url, d.repo_path, d.title, d.section, d.content,
         1 - (d.embedding <=> query_embedding) as similarity
    from public.roblox_docs d
   where 1 - (d.embedding <=> query_embedding) >= min_similarity
   order by d.embedding <=> query_embedding
   limit greatest(1, least(match_count, 20));
$$;
grant execute on function public.match_roblox_docs(vector, int, float) to authenticated;
