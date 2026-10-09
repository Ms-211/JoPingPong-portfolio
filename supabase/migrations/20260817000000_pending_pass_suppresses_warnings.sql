-- 다음 레슨권이 이미 대기 중이면 잔여 횟수 및 등록 필요 경고를 표시하지 않는다.
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
  v_has_pending boolean;
begin
  select * into v_member from public.members where id = p_member_id;

  select * into v_pass
  from public.lesson_passes
  where member_id = p_member_id
    and status = 'active'::public.lesson_pass_status
  limit 1;

  select exists (
    select 1
    from public.lesson_passes
    where member_id = p_member_id
      and status = 'pending'::public.lesson_pass_status
  ) into v_has_pending;

  if v_member.status = 'ended'::public.member_status then
    v_warnings := array_append(v_warnings, 'ended');
  end if;

  if v_pass.id is null or v_pass.used_count >= v_pass.total_count then
    if not v_has_pending then
      v_warnings := array_append(v_warnings, 'no_remaining');
    end if;
  else
    v_remaining := v_pass.total_count - v_pass.used_count;
    if v_remaining <= 2 and not v_has_pending then
      v_warnings := array_append(v_warnings, 'low_remaining');
    end if;
    if v_pass.recommended_use_by < public.business_date() then
      v_warnings := array_append(v_warnings, 'recommended_date_passed');
    end if;
  end if;

  return v_warnings;
end;
$$;
