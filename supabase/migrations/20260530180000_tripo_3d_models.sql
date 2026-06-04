-- Tripo 3D model generation: weekly-limit tracking + storage bucket.
-- One row per successful generation. We count rows in the last 7 days to
-- enforce the "1 generation per week per user" rule, and keep the stored
-- file path + Roblox import metadata for the user to download later.

create table if not exists public.model_generations_3d (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  project_id   uuid,
  prompt       text not null,
  status       text not null default 'success',
  tripo_task_id text,
  file_path    text,              -- storage path inside the bucket
  file_url     text,              -- public URL of the stored .obj/.zip
  format       text default 'OBJ',
  credits_used integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists idx_model_gen_3d_user_time
  on public.model_generations_3d (user_id, created_at desc);

alter table public.model_generations_3d enable row level security;

-- Users can read their own generations.
drop policy if exists "own 3d generations - select" on public.model_generations_3d;
create policy "own 3d generations - select"
  on public.model_generations_3d for select
  using (auth.uid() = user_id);

-- Inserts happen via the service role (server function), so no insert policy
-- for end users is required. Service role bypasses RLS.

-- Storage bucket for the generated mesh files. Public read so the user can
-- download the file the app hands them; writes are service-role only.
insert into storage.buckets (id, name, public)
values ('generated-3d-models', 'generated-3d-models', true)
on conflict (id) do nothing;

-- Allow public read of objects in this bucket.
drop policy if exists "public read 3d models" on storage.objects;
create policy "public read 3d models"
  on storage.objects for select
  using (bucket_id = 'generated-3d-models');
