-- Lock down null_byte_leaderboard.
--
-- Before: RLS was enabled but every policy was USING (true), and anon held direct
-- table grants. That meant anyone with the public anon key (it ships in the client
-- bundle by design) could:
--   * SELECT sync_code for every player -> take over any account
--   * UPDATE / DELETE / TRUNCATE any row -> wipe or forge the whole leaderboard
--
-- After: anon can only read a view with harmless columns. All writes and the
-- sync-code lookup go through SECURITY DEFINER functions that verify the caller
-- knows the row's sync code. The sync code itself is never selectable.

begin;

-- ---------------------------------------------------------------------------
-- 0. Widen sync_code
-- ---------------------------------------------------------------------------
-- The sync code is now the only secret guarding a save, and nb_load_by_sync_code
-- can be called freely. 6 chars over a 32-char alphabet is ~1.07e9 codes, so with a
-- few hundred players a blind sweep finds *someone* in a day or two. 12 chars is
-- ~1.15e18. Safe to widen now: the table is empty.
alter table public.null_byte_leaderboard
  alter column sync_code type varchar(14);

-- ---------------------------------------------------------------------------
-- 1. Take away direct table access
-- ---------------------------------------------------------------------------
revoke all on table public.null_byte_leaderboard from anon, authenticated;

drop policy if exists "public read" on public.null_byte_leaderboard;
drop policy if exists "own upsert"  on public.null_byte_leaderboard;
drop policy if exists "own update"  on public.null_byte_leaderboard;
drop policy if exists "own delete"  on public.null_byte_leaderboard;

alter table public.null_byte_leaderboard enable row level security;
-- No policies at all: PostgREST reaches this table only through the definer
-- functions below, which run as the owner and bypass RLS.

-- ---------------------------------------------------------------------------
-- 2. Public leaderboard view — safe columns only
-- ---------------------------------------------------------------------------
drop view if exists public.null_byte_leaderboard_public;
create view public.null_byte_leaderboard_public
with (security_invoker = off) as
  select
    player_id,
    name,
    name_tag,
    total_bits_earned,
    prestige_count,
    updated_at,
    game_state ->> 'activeTitle' as active_title
  from public.null_byte_leaderboard;

grant select on public.null_byte_leaderboard_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Write path — requires the row's sync code
-- ---------------------------------------------------------------------------
create or replace function public.nb_submit_score(
  p_player_id text,
  p_sync_code varchar(14),
  p_name      text,
  p_name_tag  varchar(4),
  p_bits      double precision,
  p_prestige  integer,
  p_state     jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing varchar(14);
begin
  if p_player_id is null or p_sync_code is null or p_sync_code = '' then
    raise exception 'player_id and sync_code are required';
  end if;

  select sync_code into v_existing
  from null_byte_leaderboard
  where player_id = p_player_id;

  if found and v_existing is distinct from p_sync_code then
    -- Someone is trying to write to a row they do not own.
    raise exception 'sync code mismatch';
  end if;

  insert into null_byte_leaderboard as l
    (player_id, name, name_tag, sync_code, total_bits_earned, prestige_count, game_state, updated_at)
  values
    (p_player_id, p_name, p_name_tag, p_sync_code, p_bits, p_prestige, p_state, now())
  on conflict (player_id) do update set
    name              = excluded.name,
    name_tag          = excluded.name_tag,
    total_bits_earned = excluded.total_bits_earned,
    prestige_count    = excluded.prestige_count,
    game_state        = excluded.game_state,
    updated_at        = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Cross-device restore — the only way to read a save, and only with the code
-- ---------------------------------------------------------------------------
create or replace function public.nb_load_by_sync_code(p_code varchar(14))
returns jsonb
language sql
security definer
set search_path = public
as $$
  select game_state
  from null_byte_leaderboard
  where sync_code = p_code
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 5. Name availability check (cannot read the table directly any more)
-- ---------------------------------------------------------------------------
create or replace function public.nb_is_name_tag_taken(
  p_name      text,
  p_name_tag  varchar(4),
  p_player_id text
) returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from null_byte_leaderboard
    where name = p_name
      and name_tag = p_name_tag
      and player_id is distinct from p_player_id
  );
$$;

-- ---------------------------------------------------------------------------
-- 6. Expose only the functions
-- ---------------------------------------------------------------------------
revoke all on function public.nb_submit_score(text, varchar, text, varchar, double precision, integer, jsonb) from public;
revoke all on function public.nb_load_by_sync_code(varchar) from public;
revoke all on function public.nb_is_name_tag_taken(text, varchar, text) from public;

grant execute on function public.nb_submit_score(text, varchar, text, varchar, double precision, integer, jsonb) to anon, authenticated;
grant execute on function public.nb_load_by_sync_code(varchar) to anon, authenticated;
grant execute on function public.nb_is_name_tag_taken(text, varchar, text) to anon, authenticated;

commit;
