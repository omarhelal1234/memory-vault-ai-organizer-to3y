-- Storage bucket + per-user RLS, and RLS hardening for cross-user linking.
-- Idempotent so it can be re-applied safely.

-- 1) Private 'memories' storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'memories', 'memories', false, 52428800,
  array['image/png','image/jpeg','image/jpg','image/webp','image/heic','audio/m4a','audio/mpeg','audio/mp4','audio/wav','video/mp4','video/quicktime']
)
on conflict (id) do nothing;

drop policy if exists "Users can upload own memory files" on storage.objects;
drop policy if exists "Users can read own memory files" on storage.objects;
drop policy if exists "Users can update own memory files" on storage.objects;
drop policy if exists "Users can delete own memory files" on storage.objects;

create policy "Users can upload own memory files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'memories' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can read own memory files"
  on storage.objects for select to authenticated
  using (bucket_id = 'memories' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can update own memory files"
  on storage.objects for update to authenticated
  using (bucket_id = 'memories' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can delete own memory files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'memories' and auth.uid()::text = (storage.foldername(name))[1]);

-- 2) Fix cross-user linking: junction INSERT must verify ownership of BOTH sides.
drop policy if exists "Users can insert own memory categories" on memory_categories;
create policy "Users can insert own memory categories" on memory_categories
  for insert with check (
    exists (select 1 from memories m where m.id = memory_categories.memory_id and m.user_id = auth.uid())
    and exists (select 1 from categories c where c.id = memory_categories.category_id and c.user_id = auth.uid())
  );

drop policy if exists "Users can insert own memory tags" on memory_tags;
create policy "Users can insert own memory tags" on memory_tags
  for insert with check (
    exists (select 1 from memories m where m.id = memory_tags.memory_id and m.user_id = auth.uid())
    and exists (select 1 from tags t where t.id = memory_tags.tag_id and t.user_id = auth.uid())
  );

-- 3) Prevent a category's parent_id from pointing at another user's category.
create or replace function public.enforce_category_parent_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.parent_id is not null then
    if not exists (
      select 1 from public.categories c
      where c.id = new.parent_id and c.user_id = new.user_id
    ) then
      raise exception 'parent category must belong to the same user';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists categories_parent_owner_check on categories;
create trigger categories_parent_owner_check
  before insert or update on categories
  for each row execute function public.enforce_category_parent_owner();
