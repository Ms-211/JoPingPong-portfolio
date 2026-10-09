"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { cancelLessonApproval } from "@/app/dashboard/actions";
import { RECORD_STATUS_LABELS, REQUEST_METHOD_LABELS, type RecordStatus, type RequestMethod } from "@/lib/lesson-records";

export type LessonRecordWorkspaceRow = {
  id: string;
  memberId: string;
  memberName: string;
  memberPhone: string | null;
  memberBirthDate: string | null;
  memberSkillDivision: string | null;
  remainingAfterApproval: number | null;
  lessonDate: string;
  status: RecordStatus;
  method: RequestMethod;
  dailySequence: number | null;
  coachName: string | null;
  requestedAt: string;
  processedAt: string | null;
  note: string | null;
  reason: string | null;
};

function dateTime(value: string | null) {
  if (!value) return "-";
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("month")}.${part("day")} ${part("hour")}:${part("minute")}`;
}

function timeOnly(value: string) {
  return new Date(value).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" });
}

export function LessonRecordsWorkspace({ admin, records, returnTo }: { admin: boolean; records: LessonRecordWorkspaceRow[]; returnTo: string }) {
  const [selectedId, setSelectedId] = useState(records[0]?.id);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const filteredRecords = useMemo(() => records.filter((record) => !normalizedQuery
    || record.memberName.toLocaleLowerCase("ko-KR").includes(normalizedQuery)
    || (record.memberPhone ?? "").includes(normalizedQuery)
    || (record.memberBirthDate ?? "").includes(normalizedQuery)), [normalizedQuery, records]);
  const selected = filteredRecords.find((record) => record.id === selectedId) ?? filteredRecords[0];

  return (
    <div className="records-content-grid">
      <section className="records-list-panel">
        <div className="records-list-toolbar">
          <div><h2>레슨 기록</h2><span>{filteredRecords.length}건</span></div>
          <label><span aria-hidden="true">⌕</span><input enterKeyHint="search" inputMode="search" onInput={(event) => setQuery(event.currentTarget.value)} placeholder="회원명, 전화번호 또는 생년월일 검색" spellCheck={false} type="search" value={query} /></label>
        </div>
        <div className="records-list-head"><span>레슨일</span><span>요청 시각</span><span>회원</span><span>승인 후 잔여</span><span>상태</span><span>방식</span><span>담당자</span><span>처리 시각</span></div>
        <div className="records-list-body">
          {filteredRecords.map((record) => (
            <button className={`records-list-row${selected?.id === record.id ? " selected" : ""}`} key={record.id} onClick={() => setSelectedId(record.id)} type="button">
              <strong>{record.lessonDate.replaceAll("-", ".")}</strong>
              <strong>{timeOnly(record.requestedAt)}</strong>
              <span className="records-member-cell"><strong>{record.memberName}</strong><small>{record.memberBirthDate ?? "생년월일 미등록"}{record.memberSkillDivision ? ` · ${record.memberSkillDivision}` : ""}</small></span>
              <strong className={record.remainingAfterApproval !== null && record.remainingAfterApproval <= 2 ? "records-low-remaining" : ""}>{record.remainingAfterApproval === null ? "-" : `${record.remainingAfterApproval}회`}</strong>
              <span><b className={`records-status ${record.status}`}>{RECORD_STATUS_LABELS[record.status]}</b></span>
              <span>{REQUEST_METHOD_LABELS[record.method]}</span>
              <span>{record.coachName ?? "-"}</span>
              <span>{dateTime(record.processedAt)}</span>
            </button>
          ))}
          {!filteredRecords.length && <p className="records-empty">조건에 맞는 레슨 기록이 없습니다.</p>}
        </div>
      </section>

      <aside className="records-detail-panel">
        <h2>기록 상세</h2>
        {selected ? <>
          <div className="records-detail-member"><span>{selected.memberName.slice(0, 1)}</span><div><strong>{selected.memberName}</strong><small>{selected.memberPhone ?? "전화번호 없음"}</small><small>{selected.memberBirthDate ?? "생년월일 미등록"}{selected.memberSkillDivision ? ` · ${selected.memberSkillDivision}` : ""}</small></div><Link href={`/members/${selected.memberId}`}>회원 보기</Link></div>
          <section><h3>레슨 정보</h3><dl>
            <div><dt>레슨일</dt><dd>{selected.lessonDate}</dd></div>
            <div><dt>승인 후 잔여</dt><dd className={selected.remainingAfterApproval !== null && selected.remainingAfterApproval <= 2 ? "records-low-remaining" : ""}>{selected.remainingAfterApproval === null ? "차감 전" : `${selected.remainingAfterApproval}회`}</dd></div>
            <div><dt>상태</dt><dd><b className={`records-status ${selected.status}`}>{RECORD_STATUS_LABELS[selected.status]}</b></dd></div>
            <div><dt>요청 방식</dt><dd>{REQUEST_METHOD_LABELS[selected.method]}</dd></div>
            <div><dt>당일 회차</dt><dd>{selected.dailySequence ? `${selected.dailySequence}회차` : "-"}</dd></div>
            <div><dt>실제 담당자</dt><dd>{selected.coachName ?? "-"}</dd></div>
          </dl></section>
          <section className="records-processing-section"><h3>처리 정보</h3><dl>
            <div><dt>요청·등록</dt><dd>{dateTime(selected.requestedAt)}</dd></div>
            <div><dt>처리 시각</dt><dd>{dateTime(selected.processedAt)}</dd></div>
          </dl></section>
          <section className="records-detail-note"><h3>메모·사유</h3><p>{selected.reason ?? selected.note ?? "등록된 메모가 없습니다."}</p></section>
          {admin && selected.status === "approved" && <form action={cancelLessonApproval} className="records-cancel-form"><input name="lesson_record_id" type="hidden" value={selected.id} /><input name="return_to" type="hidden" value={returnTo} /><label><span className="records-cancel-label-title">승인 취소 사유 <span className="required">필수</span></span><input name="cancellation_reason" placeholder="취소 또는 복구 사유를 입력하세요" required /></label><button type="submit">승인 취소·레슨권 복구</button></form>}
        </> : <p className="records-empty">왼쪽에서 기록을 선택하세요.</p>}
      </aside>
    </div>
  );
}
