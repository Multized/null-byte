-- Leaderboard overhaul: rank by real progression instead of total_bits_earned, which
-- resets every prestige and so ranked "bits earned this run" — a high-ascension veteran
-- who just reset showed near-zero. The new order is ascension → prestige → bits, so we
-- need ascension_count as a queryable column too.
--
-- Backward compatible: nb_submit_score gains a DEFAULTED trailing p_ascension_count, so
-- the currently-deployed 8-arg client (…, p_defense_rating) keeps saving during the
-- deploy gap; PostgREST fills the default.

begin;

alter table public.null_byte_leaderboard
  add column if not exists ascension_count integer not null default 0;

drop view if exists public.null_byte_leaderboard_public;
create view public.null_byte_leaderboard_public
with (security_invoker = off) as
  select
    player_id,
    name,
    name_tag,
    total_bits_earned,
    prestige_count,
    ascension_count,
    defense_rating,
    updated_at,
    game_state ->> 'activeTitle' as active_title
  from public.null_byte_leaderboard;
grant select on public.null_byte_leaderboard_public to anon, authenticated;

drop function if exists public.nb_submit_score(text, varchar, text, varchar, double precision, integer, jsonb, integer);

create or replace function public.nb_submit_score(
  p_player_id text,
  p_sync_code varchar(14),
  p_name      text,
  p_name_tag  varchar(4),
  p_bits      double precision,
  p_prestige  integer,
  p_state     jsonb,
  p_defense_rating integer default 0,
  p_ascension_count integer default 0
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
    (player_id, name, name_tag, sync_code, total_bits_earned, prestige_count, game_state, defense_rating, ascension_count, updated_at)
  values
    (p_player_id, p_name, p_name_tag, p_sync_code, p_bits, p_prestige, p_state, coalesce(p_defense_rating, 0), coalesce(p_ascension_count, 0), now())
  on conflict (player_id) do update set
    name              = excluded.name,
    name_tag          = excluded.name_tag,
    total_bits_earned = excluded.total_bits_earned,
    prestige_count    = excluded.prestige_count,
    game_state        = excluded.game_state,
    defense_rating    = excluded.defense_rating,
    ascension_count   = excluded.ascension_count,
    updated_at        = now();
end;
$$;

revoke all on function public.nb_submit_score(text, varchar, text, varchar, double precision, integer, jsonb, integer, integer) from public;
grant execute on function public.nb_submit_score(text, varchar, text, varchar, double precision, integer, jsonb, integer, integer) to anon, authenticated;

commit;
