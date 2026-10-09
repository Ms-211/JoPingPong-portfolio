"use client";

import { useEffect, useState } from "react";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
});

const timeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function formatKoreanTime(date: Date) {
  const parts = timeFormatter.formatToParts(date);
  const dayPeriod = parts.find((part) => part.type === "dayPeriod")?.value ?? "";
  const hour = parts.find((part) => part.type === "hour")?.value ?? "";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "";

  return `${dayPeriod} ${hour}시 ${minute}분`.trim();
}

export function CheckinClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="qr-checkin-clock">
      <time dateTime={now.toISOString()} suppressHydrationWarning>{dateFormatter.format(now)}</time>
      <strong suppressHydrationWarning>{formatKoreanTime(now)}</strong>
      <span><i />서버 연결 정상</span>
    </div>
  );
}
