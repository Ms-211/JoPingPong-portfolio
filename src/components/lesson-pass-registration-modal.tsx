"use client";

import { useEffect, useMemo, useState } from "react";

import { registerLessonPass } from "@/app/lesson-passes/actions";

export type LessonPassRegistrationMember = {
  id: string;
  name: string;
  phone: string | null;
  birthDate: string | null;
  skillDivision: string | null;
  activeRemaining: number | null;
  pendingCount: number;
};

export function LessonPassRegistrationModal({
  openInitially,
  initialMemberId,
  members,
  returnTo = "/lesson-passes",
  today,
}: {
  openInitially?: boolean;
  initialMemberId?: string;
  members: LessonPassRegistrationMember[];
  returnTo?: string;
  today: string;
}) {
  const initialMember = members.find((member) => member.id === initialMemberId);
  const [open, setOpen] = useState(openInitially ?? Boolean(initialMember));
  const [query, setQuery] = useState(initialMember?.name ?? "");
  const [selectedId, setSelectedId] = useState(initialMember?.id ?? "");
  const selected = members.find((member) => member.id === selectedId);
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const results = useMemo(() => {
    if (!normalizedQuery) return [];
    return members.filter((member) =>
      member.name.toLocaleLowerCase("ko-KR").includes(normalizedQuery)
      || (member.phone ?? "").includes(normalizedQuery)
      || (member.birthDate ?? "").includes(normalizedQuery)
      || (member.skillDivision ?? "").toLocaleLowerCase("ko-KR").includes(normalizedQuery),
    ).slice(0, 8);
  }, [members, normalizedQuery]);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.body.classList.add("modal-open");
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function selectMember(member: LessonPassRegistrationMember) {
    setSelectedId(member.id);
    setQuery(member.name);
  }

  return (
    <>
      <button className="passes-open-register" onClick={() => setOpen(true)} type="button"><span aria-hidden="true">＋</span><strong>레슨권 등록</strong></button>
      {open && (
        <div className="passes-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section aria-labelledby="passes-register-title" aria-modal="true" className="passes-register-modal" role="dialog">
            <header>
              <div><h2 id="passes-register-title">8회 레슨권 등록</h2><p>회원 검색 후 현재 레슨권 상태를 확인하고 등록하세요.</p></div>
              <button aria-label="레슨권 등록 창 닫기" onClick={() => setOpen(false)} type="button">×</button>
            </header>

            <form action={registerLessonPass}>
              <input name="return_to" type="hidden" value={returnTo} />
              <section className="passes-modal-step">
                <div className="passes-modal-step-heading"><span>1</span><div><h3>회원 선택</h3><p>이름이나 전화번호로 등록할 회원을 검색하세요.</p></div></div>
                <div className="passes-member-search">
                  <label className="passes-modal-field-title" htmlFor="lesson-pass-member-search">회원 검색 <span className="required">필수</span></label>
                  <div><span aria-hidden="true">⌕</span><input autoComplete="off" autoFocus enterKeyHint="search" id="lesson-pass-member-search" inputMode="search" onInput={(event) => { setQuery(event.currentTarget.value); setSelectedId(""); }} placeholder="이름, 전화번호 또는 생년월일 입력" spellCheck={false} type="search" value={query} /></div>
                  {!selected && normalizedQuery && <div className="passes-member-results">
                    {results.map((member) => <button key={member.id} onClick={() => selectMember(member)} type="button"><span>{member.name.slice(0, 1)}</span><div><strong>{member.name}</strong><small>{member.phone ?? "전화번호 없음"} · {member.birthDate ?? "생년월일 미등록"}{member.skillDivision ? ` · ${member.skillDivision}` : ""}</small></div><b>선택</b></button>)}
                    {!results.length && <p>검색 결과가 없습니다.</p>}
                  </div>}
                </div>

                {selected ? (
                  <section className="passes-selected-member">
                    <div className="passes-selected-identity"><span>{selected.name.slice(0, 1)}</span><div><strong>{selected.name}</strong><small>{selected.phone ?? "전화번호 없음"} · {selected.birthDate ?? "생년월일 미등록"}{selected.skillDivision ? ` · ${selected.skillDivision}` : ""}</small></div><button onClick={() => { setSelectedId(""); setQuery(""); }} type="button">다시 선택</button></div>
                    <div className="passes-selected-stats"><p><small>현재 레슨권</small><strong>{selected.activeRemaining === null ? "없음" : `${selected.activeRemaining}회 남음`}</strong></p><p><small>예비 레슨권</small><strong>{selected.pendingCount}개</strong></p></div>
                  </section>
                ) : <p className="passes-selection-guide">검색창에 회원 정보를 입력해 주세요.</p>}
              </section>

              <input name="member_id" type="hidden" value={selectedId} />
              <section className="passes-modal-step">
                <div className="passes-modal-step-heading"><span>2</span><div><h3>등록 정보</h3><p>8회 레슨권의 시작 기준일과 메모를 입력하세요.</p></div></div>
                <div className="passes-modal-fields">
                  <div className="passes-modal-field"><span className="passes-modal-field-title">등록 횟수</span><div className="passes-modal-count"><strong>8회</strong><small>권장 소진일은 등록일로부터 2개월</small></div></div>
                  <label className="passes-modal-field"><span className="passes-modal-field-title">등록일 <b className="required">필수</b></span><input defaultValue={today} name="paid_at" required type="date" /></label>
                  <label className="passes-modal-memo"><span className="passes-modal-field-title">메모 <small>선택 입력</small></span><textarea maxLength={2000} name="memo" placeholder="회원 또는 레슨권 관련 참고사항" rows={3} /></label>
                </div>
              </section>

              {selected && <div className="passes-registration-rule"><strong>등록 전 확인</strong><p>{selected.activeRemaining !== null && selected.activeRemaining > 0 ? "기존 레슨권이 남아 있어 새 레슨권은 사용 예정으로 등록됩니다." : "등록 즉시 사용할 수 있는 활성 레슨권으로 시작됩니다."}</p><small>현재 레슨권 소진 후 예비 레슨권이 자동으로 사용됩니다.</small></div>}

              <footer><button onClick={() => setOpen(false)} type="button">취소</button><button disabled={!selected} type="submit">{selected ? `${selected.name} 회원에게 8회 등록` : "회원을 먼저 선택하세요"}</button></footer>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
