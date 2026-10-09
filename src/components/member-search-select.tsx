"use client";

import { useMemo, useState } from "react";

export type SearchableMember = {
  id: string;
  name: string;
  phone: string | null;
  birthDate: string | null;
  skillDivision: string | null;
};

export function MemberSearchSelect({
  allowAll = false,
  defaultValue = "",
  inputName = "member_id",
  layout = "default",
  members,
  required = false,
}: {
  allowAll?: boolean;
  defaultValue?: string;
  inputName?: string;
  layout?: "default" | "compact";
  members: SearchableMember[];
  required?: boolean;
}) {
  const initialMember = members.find((member) => member.id === defaultValue);
  const [query, setQuery] = useState(initialMember?.name ?? "");
  const [selectedId, setSelectedId] = useState(initialMember?.id ?? "");
  const [open, setOpen] = useState(false);
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

  function clearSelection() {
    setQuery("");
    setSelectedId("");
    setOpen(false);
  }

  function selectMember(member: SearchableMember) {
    setSelectedId(member.id);
    setQuery(member.name);
    setOpen(false);
  }

  return (
    <div className="member-search-select">
      <input name={inputName} required={required} type="hidden" value={selectedId} />
      <div className="member-search-input-wrap">
        <span aria-hidden="true">⌕</span>
        <input
          autoComplete="off"
          enterKeyHint="search"
          inputMode="search"
          onBlur={() => window.setTimeout(() => setOpen(false), 300)}
          onFocus={() => setOpen(true)}
          onInput={(event) => { setQuery(event.currentTarget.value); setSelectedId(""); setOpen(true); }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
            if (event.key === "Enter" && results.length === 1) {
              event.preventDefault();
              selectMember(results[0]);
            }
          }}
          placeholder={allowAll ? "전체 회원 또는 이름·전화번호 검색" : "이름·전화번호·생년월일 검색"}
          spellCheck={false}
          type="search"
          value={query}
        />
        {(query || selectedId) && <button aria-label="회원 선택 지우기" onClick={clearSelection} type="button">×</button>}
      </div>
      {open && normalizedQuery && !selectedId && <div className="member-search-results">
        {results.map((member) => <button key={member.id} onClick={() => selectMember(member)} onPointerDown={(event) => { event.preventDefault(); selectMember(member); }} type="button">
          <span>{member.name.slice(0, 1)}</span>
          {layout === "compact" ? <div className="member-search-result-info dashboard-member-result-info">
            <div className="dashboard-member-result-name"><strong>{member.name}</strong><span><b>부수</b>{member.skillDivision ?? "미등록"}</span></div>
            <div className="dashboard-member-result-details"><span>{member.phone ?? "전화번호 없음"}</span><span><b>생년월일</b>{member.birthDate ?? "미등록"}</span></div>
          </div> : <div className="member-search-result-info">
            <div className="member-search-result-primary"><strong>{member.name}</strong><small>{member.phone ?? "전화번호 없음"}</small></div>
            <div className="member-search-result-meta"><span><b>부수</b>{member.skillDivision ?? "미등록"}</span><span><b>생년월일</b>{member.birthDate ?? "미등록"}</span></div>
          </div>}
          <b>선택하기</b>
        </button>)}
        {!results.length && <p>검색 결과가 없습니다.</p>}
      </div>}
    </div>
  );
}
