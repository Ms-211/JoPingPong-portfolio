"use client";

function formatPhoneInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function MemberPhoneInput({ defaultValue }: { defaultValue?: string | null }) {
  return (
    <input
      autoComplete="tel"
      defaultValue={defaultValue ?? ""}
      inputMode="numeric"
      maxLength={13}
      name="phone"
      onChange={(event) => { event.currentTarget.value = formatPhoneInput(event.currentTarget.value); }}
      pattern="010-[0-9]{4}-[0-9]{4}"
      placeholder="010-0000-0000"
      required
      title="010-0000-0000 형식으로 입력해 주세요."
    />
  );
}
