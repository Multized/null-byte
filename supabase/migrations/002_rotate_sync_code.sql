-- Let a client upgrade a legacy 6-char sync code to the current 12-char format.
--
-- Rotating client-side alone would be a trap: nb_submit_score checks the presented
-- code against the stored row, so a locally regenerated code would fail forever with
-- "sync code mismatch" and the player could never save again. The swap has to happen
-- on the server, proving knowledge of the old code first.

begin;

create or replace function public.nb_rotate_sync_code(
  p_player_id text,
  p_old_code  varchar(14),
  p_new_code  varchar(14)
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing varchar(14);
begin
  if p_player_id is null or p_new_code is null or p_new_code = '' then
    return false;
  end if;

  select sync_code into v_existing
  from null_byte_leaderboard
  where player_id = p_player_id;

  -- No row yet (player never set a name): nothing to keep in sync, the client is
  -- free to adopt the new code locally.
  if not found then
    return true;
  end if;

  if v_existing is distinct from p_old_code then
    return false;
  end if;

  update null_byte_leaderboard
  set sync_code = p_new_code
  where player_id = p_player_id;

  return true;
end;
$$;

revoke all on function public.nb_rotate_sync_code(text, varchar, varchar) from public;
grant execute on function public.nb_rotate_sync_code(text, varchar, varchar) to anon, authenticated;

commit;
