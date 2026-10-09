"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useState } from "react";

import { createMember } from "@/app/members/actions";
import { MemberPhoneInput } from "@/components/member-phone-input";

const WEEKDAYS = [[1, "월"], [2, "화"], [3, "수"], [4, "목"], [5, "금"], [6, "토"], [7, "일"]] as const;

export function NewMemberForm({ defaultJoinedAt }: { defaultJoinedAt: string }) {
  const [photoPreview, setPhotoPreview] = useState<string>();

  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  function previewPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPhotoPreview(file ? URL.createObjectURL(file) : undefined);
  }

  return (
    <form action={createMember} className="member-create-form">
      <section className="member-create-card">
        <div className="member-create-section-heading"><span>1</span><div><h2>기본 정보</h2><p>회원 식별과 연락에 필요한 정보를 입력하세요.</p></div></div>
        <div className="member-create-basic-grid">
          <label className="member-photo-upload">
            <input accept="image/jpeg,image/png,image/webp" name="photo" onChange={previewPhoto} type="file" />
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="선택한 회원 사진 미리보기" src={photoPreview} />
            ) : <span aria-hidden="true">♙</span>}
            <strong>{photoPreview ? "사진 변경" : "회원 사진 등록"}</strong>
            <small>JPG, PNG, WEBP · 최대 5MB</small>
          </label>
          <div className="member-create-fields">
            <label><span className="member-create-label-text">이름 <b className="required">필수</b></span><input autoFocus maxLength={30} name="name" placeholder="회원 이름을 입력하세요" required /></label>
            <label><span className="member-create-label-text">전화번호 <b className="required">필수</b></span><MemberPhoneInput /></label>
            <div className="member-create-field-row">
              <label><span className="member-create-label-text">생년월일 <b className="required">필수</b></span><input max={defaultJoinedAt} name="birth_date" required type="date" /></label>
              <label><span className="member-create-label-text">성별 <b className="required">필수</b></span><select defaultValue="" name="gender" required><option disabled value="">선택해 주세요</option><option value="male">남성</option><option value="female">여성</option></select></label>
            </div>
            <div className="member-create-field-row member-create-field-row-three">
              <label><span className="member-create-label-text">부수 <small>선택</small></span><input maxLength={30} name="skill_division" placeholder="예: 지역 5부, 선수부" /></label>
              <label><span className="member-create-label-text">등록일 <b className="required">필수</b></span><input defaultValue={defaultJoinedAt} max={defaultJoinedAt} name="joined_at" required type="date" /></label>
              <label><span className="member-create-label-text">회원 상태</span><select defaultValue="active" name="status"><option value="active">이용 중</option><option value="ended">종료</option></select></label>
            </div>
          </div>
        </div>
      </section>

      <section className="member-create-card">
        <div className="member-create-section-heading"><span>2</span><div><h2>레슨 운영 정보</h2><p>요일과 메모는 출석 승인 시 참고 정보로 사용됩니다.</p></div></div>
        <fieldset className="member-create-weekdays"><legend>고정 레슨 요일</legend><div>{WEEKDAYS.map(([value, label]) => <label key={value}><input name="fixed_weekdays" type="checkbox" value={value} /><span>{label}</span></label>)}</div></fieldset>
        <label className="member-create-important">중요 메모 <small>승인 화면에서 경고로 강조됩니다.</small><textarea maxLength={1000} name="important_memo" placeholder="건강 상태, 수업 시 주의사항 등" rows={3} /></label>
        <label>일반 메모 <small>회원 관리용 참고 사항입니다.</small><textarea maxLength={2000} name="memo" placeholder="등록 경로, 선호 시간대 등" rows={4} /></label>
      </section>

      <section className="member-create-next-step"><span>✓</span><div><strong>등록 후 회원 상세로 이동합니다</strong><p>회원 정보가 저장되면 상세 화면으로 이동합니다. 필요한 경우 해당 화면에서 8회 레슨권 등록과 회원 QR 발급을 진행하세요.</p></div></section>

      <footer className="member-create-actions"><Link href="/members">취소</Link><button type="submit">회원 등록하고 상세 보기</button></footer>
    </form>
  );
}
