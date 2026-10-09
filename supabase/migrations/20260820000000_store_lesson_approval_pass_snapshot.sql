alter table public.lesson_records
  add column pass_total_count_at_approval smallint,
  add column pass_used_count_after_approval smallint,
  add column pass_remaining_after_approval smallint;

alter table public.lesson_records
  add constraint lesson_records_approval_pass_snapshot_valid check (
    (pass_total_count_at_approval is null
      and pass_used_count_after_approval is null
      and pass_remaining_after_approval is null)
    or
    (pass_total_count_at_approval > 0
      and pass_used_count_after_approval >= 0
      and pass_remaining_after_approval >= 0
      and pass_used_count_after_approval + pass_remaining_after_approval = pass_total_count_at_approval)
  );

comment on column public.lesson_records.pass_total_count_at_approval is
'승인 당시 사용한 레슨권의 총 횟수 스냅샷';
comment on column public.lesson_records.pass_used_count_after_approval is
'해당 승인을 반영한 직후 레슨권 사용 횟수 스냅샷';
comment on column public.lesson_records.pass_remaining_after_approval is
'해당 승인을 반영한 직후 레슨권 잔여 횟수 스냅샷';

with approved_history as (
  select
    record.id,
    pass.total_count,
    greatest(
      0,
      pass.total_count - pass.used_count
      + count(*) over (
          partition by record.lesson_pass_id
          order by record.approved_at, record.id
          rows between 1 following and unbounded following
        )
    )::smallint as remaining_after
  from public.lesson_records record
  join public.lesson_passes pass on pass.id = record.lesson_pass_id
  where record.status = 'approved'::public.lesson_record_status
    and record.approved_at is not null
)
update public.lesson_records record
set
  pass_total_count_at_approval = history.total_count,
  pass_used_count_after_approval = history.total_count - history.remaining_after,
  pass_remaining_after_approval = history.remaining_after
from approved_history history
where record.id = history.id;

create function public.capture_lesson_approval_pass_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pass public.lesson_passes;
begin
  if new.status = 'approved'::public.lesson_record_status
    and (tg_op = 'INSERT' or old.status is distinct from 'approved'::public.lesson_record_status)
    and new.lesson_pass_id is not null
  then
    select * into v_pass
    from public.lesson_passes
    where id = new.lesson_pass_id;

    if v_pass.id is not null then
      new.pass_total_count_at_approval := v_pass.total_count;
      new.pass_used_count_after_approval := v_pass.used_count;
      new.pass_remaining_after_approval := v_pass.total_count - v_pass.used_count;
    end if;
  end if;

  return new;
end;
$$;

create trigger lesson_records_capture_approval_pass_snapshot
before insert or update of status on public.lesson_records
for each row
execute function public.capture_lesson_approval_pass_snapshot();

