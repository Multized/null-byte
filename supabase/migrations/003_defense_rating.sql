-- Chip phase 2: record each base's defense rating on the server so phase-3 raid
-- matchmaking can find opponents by strength. The base layout itself already rides in
-- game_state (which nb_submit_score stores); this adds defense_rating as a first-class,
-- queryable column and exposes it on the public leaderboard view.
--
-- Backward compatible: the new nb_submit_score adds p_defense_rating as a DEFAULTED
-- trailing parameter, so old clients calling with the previous 7 named args keep working
-- during the deploy gap (PostgREST fills the default).

begin;

alter table public.null_byte_leaderboard
  add column if not exists defense_rating integer not null default 0;

-- Public view gains defense_rating (not a secret; a matchmaking hint).
drop view if exists public.null_byte_leaderboard_public;
create view public.null_byte_leaderboard_public
with (security_invoker = off) as
  select
    player_id,
    name,
    name_tag,
    total_bits_earned,
    prestige_count,
    defense_rating,
    updated_at,
    game_state ->> 'activeTitle' as active_title
  from public.null_byte_leaderboard;
grant select on public.null_byte_leaderboard_public to anon, authenticated;

-- Replace the write path. Drop the old signature so PostgREST has one unambiguous
-- function; the new one is a superset with a defaulted last arg, so 7-arg callers still
-- resolve to it.
drop function if exists public.nb_submit_score(text, varchar, text, varchar, double precision, integer, jsonb);

create or replace function public.nb_submit_score(
  p_player_id text,
  p_sync_code varchar(14),
  p_name      text,
  p_name_tag  varchar(4),
  p_bits      double precision,
  p_prestige  integer,
  p_state     jsonb,
  p_defense_rating integer default 0
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
    raise exception 'sync code mismatch';
  end if;

  insert into null_byte_leaderboard as l
    (player_id, name, name_tag, sync_code, total_bits_earned, prestige_count, game_state, defense_rating, updated_at)
  values
    (p_player_id, p_name, p_name_tag, p_sync_code, p_bits, p_prestige, p_state, coalesce(p_defense_rating, 0), now())
  on conflict (player_id) do update set
    name              = excluded.name,
    name_tag          = excluded.name_tag,
    total_bits_earned = excluded.total_bits_earned,
    prestige_count    = excluded.prestige_count,
    game_state        = excluded.game_state,
    defense_rating    = excluded.defense_rating,
    updated_at        = now();
end;
$$;

revoke all on function public.nb_submit_score(text, varchar, text, varchar, double precision, integer, jsonb, integer) from public;
grant execute on function public.nb_submit_score(text, varchar, text, varchar, double precision, integer, jsonb, integer) to anon, authenticated;

commit;
