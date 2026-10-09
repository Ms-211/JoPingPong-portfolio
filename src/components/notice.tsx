"use client";

import { useEffect, useState } from "react";

export function Notice({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  const message = error ?? success;

  if (!message) return null;

  return (
    <TimedNotice
      key={`${error ? "error" : "success"}:${message}`}
      message={message}
      isError={Boolean(error)}
    />
  );
}

function TimedNotice({
  message,
  isError,
}: {
  message: string;
  isError: boolean;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.delete("success");
      url.searchParams.delete("error");
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
      setVisible(false);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <p
      className={`notice notice-toast ${isError ? "error-notice" : "success-notice"}`}
      role="status"
    >
      {message}
    </p>
  );
}
