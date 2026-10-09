-- 신규/수정 회원의 전화번호 형식과 중복을 DB에서도 최종 방어한다.
alter table public.members
  add constraint members_name_max_length
  check (length(trim(name)) between 1 and 30);

alter table public.members
  add constraint members_phone_format
  check (phone is null or phone ~ '^010-[0-9]{4}-[0-9]{4}$');

-- 기존 더미 데이터의 중복은 보존하되 앞으로 입력되는 중복은 직렬화해서 차단한다.
create function public.validate_member_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.phone is not null
    and (tg_op = 'INSERT' or new.phone is distinct from old.phone) then
    perform pg_advisory_xact_lock(hashtextextended(new.phone, 31));
    if exists (
      select 1 from public.members
      where phone = new.phone and id <> new.id
    ) then
      raise exception '이미 등록된 전화번호입니다. 기존 회원을 확인해 주세요.' using errcode = '23505';
    end if;
  end if;

  if new.birth_date is not null
    and (
      tg_op = 'INSERT'
      or lower(trim(new.name)) is distinct from lower(trim(old.name))
      or new.birth_date is distinct from old.birth_date
    ) then
    perform pg_advisory_xact_lock(hashtextextended(lower(trim(new.name)) || ':' || new.birth_date::text, 32));
    if exists (
      select 1 from public.members
      where lower(trim(name)) = lower(trim(new.name))
        and birth_date = new.birth_date
        and id <> new.id
    ) then
      raise exception '이름과 생년월일이 같은 회원이 이미 있습니다. 동명이인 여부를 확인해 주세요.' using errcode = '23505';
    end if;
  end if;

  return new;
end;
$$;

create trigger members_validate_identity
before insert or update of name, phone, birth_date on public.members
for each row execute function public.validate_member_identity();

create function public.validate_member_dates()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.birth_date is not null and new.birth_date > current_date then
    raise exception '생년월일은 미래 날짜일 수 없습니다.' using errcode = '23514';
  end if;
  if new.joined_at > current_date then
    raise exception '등록일은 미래 날짜일 수 없습니다.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger members_validate_dates
before insert or update of birth_date, joined_at on public.members
for each row execute function public.validate_member_dates();
