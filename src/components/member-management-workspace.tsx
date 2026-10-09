"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

export type MemberManagementRow = {
  id: string;
  name: string;
  phone: string | null;
  birthDate: string | null;
  skillDivision: string | null;
  status: "active" | "ended";
  photoUrl?: string;
  fixedWeekdays: number[];
  remaining: number | null;
  totalCount: number | null;
  usedCount: number | null;
  recommendedUseBy: string | null;
  recentLessons: Array<{ id: string; lesson_date: string; approved_at: string | null }>;
  memo: string | null;
  importantMemo: string | null;
  hasPendingPass: boolean;
  pendingRemaining: number;
};

type MemberFilter = "all" | "active" | "ended" | "low";

const FILTERS: Array<{ value: MemberFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "active", label: "이용 중" },
  { value: "ended", label: "종료" },
  { value: "low", label: "잔여 2회 이하" },
];

const STATUS_LABELS = { active: "이용 중", ended: "종료" } as const;
const WEEKDAY_LABELS: Record<number, string> = { 1: "월", 2: "화", 3: "수", 4: "목", 5: "금", 6: "토", 7: "일" };

function weekdayLabel(weekdays: number[]) {
  return weekdays.map((weekday) => WEEKDAY_LABELS[weekday]).filter(Boolean).join(" · ") || "-";
}

function Avatar({ member, large = false }: { member: MemberManagementRow; large?: boolean }) {
  return member.photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="" className={`members-avatar${large ? " large" : ""}`} src={member.photoUrl} />
  ) : (
    <span className={`members-avatar members-avatar-placeholder${large ? " large" : ""}`}>{member.name.slice(0, 1)}</span>
  );
}

function formatRecentLesson(lesson: MemberManagementRow["recentLessons"][number]) {
  const date = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(new Date(`${lesson.lesson_date}T00:00:00+09:00`));
  const time = lesson.approved_at
    ? new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(lesson.approved_at))
    : "시간 미기록";
  return `${date} ${time}`;
}

function formatTableDate(date: string | null) {
  return date?.replaceAll("-", ".") ?? "-";
}

export function MemberManagementWorkspace({ initialFilter = "all", initialQuery = "", initialSelectedId, rows }: { initialFilter?: MemberFilter; initialQuery?: string; initialSelectedId?: string; rows: MemberManagementRow[] }) {
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<MemberFilter>(initialFilter);
  const [selectedId, setSelectedId] = useState(rows.some((member) => member.id === initialSelectedId) ? initialSelectedId : rows[0]?.id);
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const filteredRows = useMemo(() => rows.filter((member) => {
    const matchesQuery = !normalizedQuery || member.name.toLocaleLowerCase("ko-KR").includes(normalizedQuery) || (member.phone ?? "").includes(normalizedQuery) || (member.birthDate ?? "").includes(normalizedQuery) || (member.skillDivision ?? "").toLocaleLowerCase("ko-KR").includes(normalizedQuery);
    const totalRemaining = (member.remaining ?? 0) + member.pendingRemaining;
    const matchesFilter = filter === "all" || (filter === "low" ? totalRemaining > 0 && totalRemaining <= 2 : member.status === filter);
    return matchesQuery && matchesFilter;
  }), [filter, normalizedQuery, rows]);
  const selected = filteredRows.find((member) => member.id === selectedId) ?? filteredRows[0];
  const selectedUsageRate = selected?.totalCount
    ? Math.min(100, Math.round(((selected.usedCount ?? 0) / selected.totalCount) * 100))
    : 0;

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(searchInput);
  }

  return (
    <>
      <section className="members-search-panel">
        <form onSubmit={submitSearch}>
          <label><span aria-hidden="true">⌕</span><input aria-label="회원 이름, 전화번호 또는 생년월일 검색" enterKeyHint="search" inputMode="search" onInput={(event) => { setSearchInput(event.currentTarget.value); setQuery(event.currentTarget.value); }} placeholder="이름, 전화번호 또는 생년월일 검색" spellCheck={false} type="search" value={searchInput} /></label>
          <button type="submit">검색</button>
          <Link className="members-new-link" href="/members/new">＋ 신규 회원 등록</Link>
        </form>
        <div className="members-filter-tabs" aria-label="회원 상태 필터">
          {FILTERS.map((item) => <button className={filter === item.value ? "active" : ""} key={item.value} onClick={() => setFilter(item.value)} type="button">{item.label}</button>)}
          <span className="members-result-count">{filter === "all" && !normalizedQuery ? `전체 회원 ${rows.length}명` : `검색 결과 ${filteredRows.length}명 / 전체 ${rows.length}명`}</span>
        </div>
      </section>

      <div className="members-content-grid">
        <section className="members-list-panel">
          <div className="members-list-body">
            <div className="members-list-head"><span>회원명</span><span>연락처</span><span>고정 요일</span><span>현재 잔여</span><span>예비 횟수</span><span>권장 소진일</span><span>상태</span></div>
            {filteredRows.map((member) => (
              <div className={`members-list-row${selected?.id === member.id ? " selected" : ""}`} key={member.id} onClick={() => setSelectedId(member.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(member.id); } }} role="button" tabIndex={0}>
                <span className="members-name-cell"><Avatar member={member} /><span><Link href={`/members/${member.id}`} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}><strong>{member.name}</strong></Link><small>{member.birthDate ?? "생년월일 미등록"}{member.skillDivision ? ` · ${member.skillDivision}` : ""}</small></span></span>
                <span>{member.phone ?? "-"}</span>
                <span>{weekdayLabel(member.fixedWeekdays)}</span>
                <strong className={(member.remaining ?? 0) + member.pendingRemaining > 0 && (member.remaining ?? 0) + member.pendingRemaining <= 2 ? "members-danger" : ""}>{member.remaining === null ? "-" : `${member.remaining}회`}</strong>
                <strong className="members-pending-count">{member.pendingRemaining > 0 ? `${member.pendingRemaining}회` : "-"}</strong>
                <span>{formatTableDate(member.recommendedUseBy)}</span>
                <span><b className={`members-status ${member.status}`}>{STATUS_LABELS[member.status]}</b></span>
              </div>
            ))}
            {!filteredRows.length && <p className="members-empty">조건에 맞는 회원이 없습니다.</p>}
          </div>
        </section>

        <section className="members-summary-panel">
          {selected ? (
            <>
              <div className="members-summary-profile"><Avatar large member={selected} /><div><div className="members-summary-title"><strong>{selected.name}</strong><span className={`members-status ${selected.status}`}>{STATUS_LABELS[selected.status]}</span></div><dl className="members-summary-facts"><div><dt>전화번호</dt><dd>{selected.phone ?? "미등록"}</dd></div><div><dt>생년월일</dt><dd>{selected.birthDate ?? "미등록"}</dd></div><div><dt>부수</dt><dd>{selected.skillDivision ?? "미등록"}</dd></div></dl><em>{selected.fixedWeekdays.length ? `${weekdayLabel(selected.fixedWeekdays)} 고정 레슨` : "고정 요일 미지정"}</em></div></div>
              <section className="members-pass-detail">
                <div className="members-pass-summary"><div><small>현재 레슨</small><strong className={(selected.remaining ?? 0) + selected.pendingRemaining > 0 && (selected.remaining ?? 0) + selected.pendingRemaining <= 2 ? "members-danger" : ""}>{selected.remaining === null ? "-" : `${selected.remaining}회`}</strong></div><div><small>예비 레슨</small><strong className="members-pending-count">{selected.pendingRemaining > 0 ? `${selected.pendingRemaining}회` : "없음"}</strong></div></div>
                <div className="members-usage-summary"><div><span>사용 현황</span><b>{selected.usedCount ?? 0}회 / {selected.totalCount ?? 0}회</b></div><div className="members-usage-track"><i style={{ width: `${selectedUsageRate}%` }} /></div><small>{selected.totalCount ? `${selectedUsageRate}% 사용` : "등록된 레슨권이 없습니다."}</small></div>
              </section>
              <section className="members-memo-panel"><h3>메모</h3>{selected.importantMemo && <p className="important"><strong>중요</strong>{selected.importantMemo}</p>}<p className="general">{selected.memo ?? "등록된 일반 메모가 없습니다."}</p></section>
              <div className="members-recent-lessons"><div><h3>최근 이용 기록</h3><Link href={`/lesson-records?member_id=${selected.id}`}>전체 보기 ›</Link></div>{selected.recentLessons.map((lesson) => <p key={lesson.id}><span>▣</span><time dateTime={lesson.approved_at ?? lesson.lesson_date}>{formatRecentLesson(lesson)}</time><b>출석</b></p>)}{!selected.recentLessons.length && <p className="members-no-history">최근 출석 기록이 없습니다.</p>}</div>
            </>
          ) : <p className="members-empty">왼쪽에서 회원을 선택하세요.</p>}
        </section>
      </div>
    </>
  );
}
