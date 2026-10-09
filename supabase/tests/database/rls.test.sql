begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';

select is(
  (
    select count(*)
    from public.profiles
    where id in (
      '10000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002'
    )
  ),
  2::bigint,
  'an admin can read all staff profiles'
);

select lives_ok(
  $$insert into public.members (name) values ('관리자 등록 회원')$$,
  'an admin can create a member'
);

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';

select is(
  (select count(*) from public.profiles),
  1::bigint,
  'a coach can read only their own profile'
);

select is(
  (select count(*) from public.members where name = '관리자 등록 회원'),
  1::bigint,
  'a coach can read members'
);

select throws_ok(
  $$insert into public.members (name) values ('허용되지 않은 등록')$$,
  '42501',
  null,
  'a coach cannot create a member'
);

reset role;
update public.profiles
set is_active = false
where id = '10000000-0000-0000-0000-000000000002';

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';

select is(
  (select count(*) from public.members where name = '관리자 등록 회원'),
  1::bigint,
  'profile activation state does not block a coach'
);

select * from finish();
rollback;
