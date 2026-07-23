-- Chip phase 3a: raiding. Async, snapshot-based, minted loot (a raid never deducts from
-- the victim), so the server side only manages the DEFENDER's state: a shield after being
-- breached (so they aren't farmed) and a bounty when their base repels a raid.
--
-- All access stays behind SECURITY DEFINER functions (the lockdown model): the raid-target
-- lookup exposes only a base snapshot (layout + defense + a loot figure), never secrets.

begin;

alter table public.null_byte_leaderboard
  add column if not exists shield_until    timestamptz,
  add column if not exists pending_bounty  double precision not null default 0;

-- ---------------------------------------------------------------------------
-- Find one raid target: a real player who isn't you, has a name, and isn't shielded.
-- Returns a safe snapshot — id, name, defense, this-run bits (drives loot), and the chip
-- layout to breach. No sync_code, no full game_state.
-- ---------------------------------------------------------------------------
create or replace function public.nb_get_raid_target(p_player_id text)
returns table (
  player_id text,
  name text,
  name_tag varchar,
  defense_rating integer,
  total_bits_earned double precision,
  chip_cells jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    l.player_id, l.name, l.name_tag, l.defense_rating, l.total_bits_earned,
    coalesce(l.game_state -> 'chipCells', '{}'::jsonb)
  from null_byte_leaderboard l
  where l.player_id is distinct from p_player_id
    and l.name is not null and l.name <> ''
    and (l.shield_until is null or l.shield_until < now())
  order by random()
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Record a raid outcome against the target (the attacker's own loot is minted client-side,
-- so nothing here touches the attacker's bits). Won -> shield the defender so they aren't
-- farmed. Repelled -> mint the defender a bounty (server-computed from their own run bits,
-- never trusting a client figure).
-- ---------------------------------------------------------------------------
create or replace function public.nb_resolve_raid(
  p_attacker_id text,
  p_target_id   text,
  p_won         boolean
) returns double precision
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_bits double precision;
  v_bounty double precision := 0;
begin
  if p_attacker_id is null or p_target_id is null or p_attacker_id = p_target_id then
    return 0;
  end if;

  select total_bits_earned into v_target_bits
  from null_byte_leaderboard where player_id = p_target_id;
  if not found then return 0; end if;

  if p_won then
    -- breached: protect the defender from being farmed for a while
    update null_byte_leaderboard
    set shield_until = now() + interval '3 hours'
    where player_id = p_target_id;
  else
    -- repelled: the defender earns a bounty (2% of their run's bits), minted, claimed later
    v_bounty := greatest(0, coalesce(v_target_bits, 0)) * 0.02;
    update null_byte_leaderboard
    set pending_bounty = pending_bounty + v_bounty
    where player_id = p_target_id;
  end if;

  return v_bounty;
end;
$$;

-- ---------------------------------------------------------------------------
-- Claim (and clear) the bounty owed to a player for raids their base repelled. Requires the
-- sync code so nobody else can drain your pending bounty.
-- ---------------------------------------------------------------------------
create or replace function public.nb_claim_bounty(
  p_player_id text,
  p_sync_code varchar(14)
) returns double precision
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing varchar(14);
  v_amount double precision;
begin
  select sync_code, pending_bounty into v_existing, v_amount
  from null_byte_leaderboard where player_id = p_player_id;
  if not found or v_existing is distinct from p_sync_code then return 0; end if;

  if coalesce(v_amount, 0) > 0 then
    update null_byte_leaderboard set pending_bounty = 0 where player_id = p_player_id;
  end if;
  return coalesce(v_amount, 0);
end;
$$;

revoke all on function public.nb_get_raid_target(text) from public;
revoke all on function public.nb_resolve_raid(text, text, boolean) from public;
revoke all on function public.nb_claim_bounty(text, varchar) from public;
grant execute on function public.nb_get_raid_target(text) to anon, authenticated;
grant execute on function public.nb_resolve_raid(text, text, boolean) to anon, authenticated;
grant execute on function public.nb_claim_bounty(text, varchar) to anon, authenticated;

commit;
