alter table public.lesson_passes
rename column expires_at to recommended_use_by;

comment on column public.lesson_passes.recommended_use_by is
  'Recommended consumption date calculated as paid_at + 2 calendar months - 1 day. Passing this date never changes status or removes remaining lessons automatically.';

alter table public.member_qr_tokens
add column qr_path text;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'member-private',
  'member-private',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy member_private_staff_select
on storage.objects for select to authenticated
using (
  bucket_id = 'member-private'
  and (select public.is_active_staff())
);

create policy member_private_admin_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'member-private'
  and (select public.is_admin())
);

create policy member_private_admin_update
on storage.objects for update to authenticated
using (
  bucket_id = 'member-private'
  and (select public.is_admin())
)
with check (
  bucket_id = 'member-private'
  and (select public.is_admin())
);

create policy member_private_admin_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'member-private'
  and (select public.is_admin())
);

create function public.audit_business_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_entity_id uuid;
  v_reason text;
begin
  v_old := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_new := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_entity_id := coalesce((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid);
  v_reason := nullif(current_setting('app.audit_reason', true), '');

  insert into public.audit_logs (
    entity_type,
    entity_id,
    action,
    before_data,
    after_data,
    reason,
    actor_id
  )
  values (
    tg_table_name,
    v_entity_id,
    lower(tg_op),
    v_old,
    v_new,
    v_reason,
    (select auth.uid())
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger members_audit_business_change
after insert or update on public.members
for each row execute function public.audit_business_row_change();

create trigger member_qr_tokens_audit_business_change
after insert or update on public.member_qr_tokens
for each row execute function public.audit_business_row_change();

create trigger lesson_passes_audit_business_change
after insert or update on public.lesson_passes
for each row execute function public.audit_business_row_change();

create function public.register_lesson_pass(
  p_member_id uuid,
  p_paid_at date,
  p_paid_amount numeric,
  p_payment_method text,
  p_memo text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pass_id uuid;
  v_status public.lesson_pass_status;
begin
  if not (select public.is_admin()) then
    raise exception '관리자만 레슨권을 등록할 수 있습니다.' using errcode = '42501';
  end if;

  if p_paid_at is null
    or p_paid_amount is null
    or p_paid_amount < 0
    or nullif(trim(p_payment_method), '') is null then
    raise exception '결제 정보를 확인해 주세요.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.members where id = p_member_id) then
    raise exception '회원을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_member_id::text, 0));

  if exists (
    select 1
    from public.lesson_passes
    where member_id = p_member_id
      and status = 'active'::public.lesson_pass_status
  ) then
    v_status := 'pending'::public.lesson_pass_status;
  else
    v_status := 'active'::public.lesson_pass_status;
  end if;

  perform set_config('app.audit_reason', '레슨권 결제 등록', true);

  insert into public.lesson_passes (
    member_id,
    product_name,
    total_count,
    used_count,
    start_date,
    paid_at,
    paid_amount,
    payment_method,
    status,
    created_by,
    memo
  )
  values (
    p_member_id,
    '8회 레슨권',
    8,
    0,
    case when v_status = 'active' then p_paid_at else null end,
    p_paid_at,
    p_paid_amount,
    trim(p_payment_method),
    v_status,
    (select auth.uid()),
    nullif(trim(p_memo), '')
  )
  returning id into v_pass_id;

  return v_pass_id;
end;
$$;

create function public.manually_expire_lesson_pass(
  p_lesson_pass_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pass public.lesson_passes;
  v_next_pass_id uuid;
begin
  if not (select public.is_admin()) then
    raise exception '관리자만 레슨권을 수동 만료할 수 있습니다.' using errcode = '42501';
  end if;

  if nullif(trim(p_reason), '') is null then
    raise exception '수동 만료 사유가 필요합니다.' using errcode = '22023';
  end if;

  select * into v_pass
  from public.lesson_passes
  where id = p_lesson_pass_id
  for update;

  if not found then
    raise exception '레슨권을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  if v_pass.status not in (
    'active'::public.lesson_pass_status,
    'pending'::public.lesson_pass_status
  ) then
    raise exception '사용 중 또는 사용 대기 레슨권만 수동 만료할 수 있습니다.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_pass.member_id::text, 0));
  perform set_config('app.audit_reason', trim(p_reason), true);

  update public.lesson_passes
  set status = 'expired'::public.lesson_pass_status
  where id = p_lesson_pass_id;

  if v_pass.status = 'active'::public.lesson_pass_status then
    select id into v_next_pass_id
    from public.lesson_passes
    where member_id = v_pass.member_id
      and status = 'pending'::public.lesson_pass_status
    order by paid_at, created_at, id
    limit 1
    for update;

    if v_next_pass_id is not null then
      perform set_config('app.audit_reason', '이전 레슨권 수동 만료 후 대기권 활성화', true);

      update public.lesson_passes
      set
        status = 'active'::public.lesson_pass_status,
        start_date = coalesce(start_date, current_date)
      where id = v_next_pass_id;
    end if;
  end if;

  return v_next_pass_id;
end;
$$;

create function public.issue_member_qr(
  p_member_id uuid,
  p_token_hash text,
  p_qr_path text,
  p_reissue_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_id uuid;
  v_token_id uuid;
begin
  if not (select public.is_admin()) then
    raise exception '관리자만 QR을 발급할 수 있습니다.' using errcode = '42501';
  end if;

  if length(p_token_hash) < 64 or nullif(trim(p_qr_path), '') is null then
    raise exception 'QR 발급 정보를 확인해 주세요.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.members where id = p_member_id) then
    raise exception '회원을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  select id into v_existing_id
  from public.member_qr_tokens
  where member_id = p_member_id
    and is_active
  for update;

  if v_existing_id is not null and nullif(trim(p_reissue_reason), '') is null then
    raise exception 'QR 재발급 사유가 필요합니다.' using errcode = '22023';
  end if;

  if v_existing_id is not null then
    perform set_config('app.audit_reason', trim(p_reissue_reason), true);

    update public.member_qr_tokens
    set
      is_active = false,
      revoked_at = now(),
      revoked_reason = trim(p_reissue_reason)
    where id = v_existing_id;
  end if;

  perform set_config(
    'app.audit_reason',
    case when v_existing_id is null then '최초 QR 발급' else trim(p_reissue_reason) end,
    true
  );

  insert into public.member_qr_tokens (
    member_id,
    token_hash,
    qr_path,
    issued_by
  )
  values (
    p_member_id,
    p_token_hash,
    trim(p_qr_path),
    (select auth.uid())
  )
  returning id into v_token_id;

  return v_token_id;
end;
$$;

revoke all on function public.register_lesson_pass(uuid, date, numeric, text, text) from public, anon;
revoke all on function public.manually_expire_lesson_pass(uuid, text) from public, anon;
revoke all on function public.issue_member_qr(uuid, text, text, text) from public, anon;

grant execute on function public.register_lesson_pass(uuid, date, numeric, text, text) to authenticated;
grant execute on function public.manually_expire_lesson_pass(uuid, text) to authenticated;
grant execute on function public.issue_member_qr(uuid, text, text, text) to authenticated;
