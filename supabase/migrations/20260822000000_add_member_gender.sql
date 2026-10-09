alter table public.members
  add column gender text;

alter table public.members
  add constraint members_gender_valid
  check (gender is null or gender in ('male', 'female'));

comment on column public.members.gender is
  '회원 상세 화면에서 사용하는 성별. 기존 회원은 미등록 상태를 허용한다.';
