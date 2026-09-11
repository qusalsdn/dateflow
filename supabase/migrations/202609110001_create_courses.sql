create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  course_data jsonb not null,
  public_id uuid not null unique default gen_random_uuid(),
  is_shared boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.courses enable row level security;

create policy "Users can view their own courses" on public.courses for select using (auth.uid() = user_id);
create policy "Users can create their own courses" on public.courses for insert with check (auth.uid() = user_id);
create policy "Users can update their own courses" on public.courses for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own courses" on public.courses for delete using (auth.uid() = user_id);

create or replace function public.get_shared_course(requested_public_id uuid)
returns table (public_id uuid, title text, course_data jsonb, created_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select c.public_id, c.title, c.course_data, c.created_at
  from public.courses c
  where c.public_id = requested_public_id and c.is_shared = true
  limit 1;
$$;

revoke all on function public.get_shared_course(uuid) from public;
grant execute on function public.get_shared_course(uuid) to anon, authenticated;
