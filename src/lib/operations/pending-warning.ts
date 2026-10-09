const KOREA_TIME_ZONE = "Asia/Seoul";

export function parsePendingWarningTime(value: string | undefined) {
  const match = value?.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export function isPendingWarningTime(
  value: string | undefined,
  now = new Date(),
) {
  const cutoff = parsePendingWarningTime(value);
  if (!cutoff) return false;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: KOREA_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const currentMinutes = Number(values.hour) * 60 + Number(values.minute);
  return currentMinutes >= cutoff.hour * 60 + cutoff.minute;
}

