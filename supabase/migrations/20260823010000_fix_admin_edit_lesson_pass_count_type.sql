drop function if exists public.admin_edit_lesson_pass(uuid, date, smallint, text, text);

create function public.admin_edit_lesson_pass(
  p_lesson_pass_id uuid,
  p_paid_at date,
  p_remaining_count integer,
  p_memo text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pass public.lesson_passes;
  v_previous_remaining smallint;
  v_adjustment smallint;
  v_next_pass_id uuid;
begin
  if not (select public.is_admin()) then
    raise exception '관리자만 레슨권을 수정할 수 있습니다.' using errcode = '42501';
  end if;

  if p_paid_at is null then
    raise exception '등록일을 확인해 주세요.' using errcode = '22023';
  end if;

  if p_remaining_count is null or p_remaining_count not between 0 and 8 then
    raise exception '잔여 횟수는 0회에서 8회 사이여야 합니다.' using errcode = '22023';
  end if;

  if nullif(trim(p_reason), '') is null then
    raise exception '레슨권 수정 사유가 필요합니다.' using errcode = '22023';
  end if;

  if length(coalesce(p_memo, '')) > 2000 then
    raise exception '메모는 2000자 이하로 입력해 주세요.' using errcode = '22023';
  end if;

  select * into v_pass
  from public.lesson_passes
  where id = p_lesson_pass_id
  for update;

  if not found then
    raise exception '레슨권을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_pass.member_id::text, 0));

  v_previous_remaining := v_pass.total_count - v_pass.used_count;
  v_adjustment := (p_remaining_count - v_previous_remaining)::smallint;

  if v_adjustment <> 0 and v_pass.status not in (
    'active'::public.lesson_pass_status,
    'pending'::public.lesson_pass_status
  ) then
    raise exception '사용 중 또는 사용 예정 레슨권만 잔여 횟수를 조정할 수 있습니다.' using errcode = '22023';
  end if;

  perform set_config('app.audit_reason', trim(p_reason), true);

  update public.lesson_passes
  set
    paid_at = p_paid_at,
    used_count = total_count - p_remaining_count,
    memo = nullif(trim(p_memo), ''),
    status = case
      when status in ('active'::public.lesson_pass_status, 'pending'::public.lesson_pass_status)
        and p_remaining_count = 0
        then 'exhausted'::public.lesson_pass_status
      else status
    end
  where id = p_lesson_pass_id;

  if v_adjustment <> 0 then
    insert into public.pass_adjustments (
      lesson_pass_id,
      adjustment_count,
      reason,
      adjusted_by
    ) values (
      p_lesson_pass_id,
      v_adjustment,
      trim(p_reason),
      (select auth.uid())
    );
  end if;

  if v_pass.status = 'active'::public.lesson_pass_status and p_remaining_count = 0 then
    select id into v_next_pass_id
    from public.lesson_passes
    where member_id = v_pass.member_id
      and status = 'pending'::public.lesson_pass_status
      and used_count < total_count
    order by paid_at, created_at, id
    limit 1
    for update;

    if v_next_pass_id is not null then
      perform set_config('app.audit_reason', '기존 레슨권 잔여 0회 조정 후 예비 레슨권 활성화', true);

      update public.lesson_passes
      set
        status = 'active'::public.lesson_pass_status,
        start_date = coalesce(start_date, current_date)
      where id = v_next_pass_id;
    end if;
  end if;

  return p_lesson_pass_id;
end;
$$;

revoke all on function public.admin_edit_lesson_pass(uuid, date, integer, text, text) from public, anon;
grant execute on function public.admin_edit_lesson_pass(uuid, date, integer, text, text) to authenticated;
