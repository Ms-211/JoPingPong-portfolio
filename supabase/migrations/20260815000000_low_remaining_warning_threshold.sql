create or replace function public.checkin_warnings(p_member_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_member public.members;
  v_pass public.lesson_passes;
  v_warnings text[] := '{}'::text[];
  v_remaining integer;
begin
  select * into v_member
  from public.members
  where id = p_member_id;

  select * into v_pass
  from public.lesson_passes
  where member_id = p_member_id
    and status = 'active'::public.lesson_pass_status
  limit 1;

  if v_member.status = 'paused'::public.member_status then
    v_warnings := array_append(v_warnings, 'paused');
  elsif v_member.status = 'ended'::public.member_status then
    v_warnings := array_append(v_warnings, 'ended');
  end if;

  if v_pass.id is null or v_pass.used_count >= v_pass.total_count then
    v_warnings := array_append(v_warnings, 'no_remaining');
  else
    v_remaining := v_pass.total_count - v_pass.used_count;

    if v_remaining <= 2 then
      v_warnings := array_append(v_warnings, 'low_remaining');
    end if;

    if v_pass.recommended_use_by < public.business_date() then
      v_warnings := array_append(v_warnings, 'recommended_date_passed');
    end if;
  end if;

  return v_warnings;
end;
$$;
