"use client";

import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { CheckinClock } from "@/components/checkin-clock";
import { tokenFromCheckinQr } from "@/lib/checkin/qr-payload";
import {
  CHECKIN_REQUEST_ERROR_VIEW,
  checkinResultView,
  checkinWarningLabels,
  IDLE_CHECKIN_VIEW,
  INVALID_SCANNED_QR_VIEW,
  type CheckinResult,
  type CheckinResultView,
} from "@/lib/checkin/types";

type ScannerMode = "initializing" | "confirming" | "scanning" | "processing" | "showing" | "camera_error";

const PROCESSING_VIEW: CheckinResultView = {
  tone: "info",
  symbol: "…",
  title: "QR 확인 중",
  message: "회원 정보를 확인하고 있습니다.",
  status: "잠시만 기다려 주세요.",
};

function cameraErrorView(error: unknown): CheckinResultView {
  const name = error instanceof DOMException ? error.name : "";

  if (name === "NotAllowedError" || name === "SecurityError") {
    return { tone: "error", symbol: "×", title: "카메라 권한이 필요합니다.", message: "브라우저의 카메라 사용을 허용해 주세요.", status: "권한을 허용한 뒤 다시 시도해 주세요." };
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return { tone: "error", symbol: "×", title: "사용 가능한 카메라가 없습니다.", message: "연결된 카메라를 확인해 주세요.", status: "카메라 연결 후 다시 시도해 주세요." };
  }
  if (name === "NotReadableError") {
    return { tone: "error", symbol: "×", title: "카메라를 시작할 수 없습니다.", message: "다른 프로그램에서 카메라를 사용 중일 수 있습니다.", status: "다른 프로그램을 종료한 뒤 다시 시도해 주세요." };
  }
  return { tone: "error", symbol: "×", title: "카메라를 시작할 수 없습니다.", message: "HTTPS 연결 또는 카메라 상태를 확인해 주세요.", status: "확인 후 다시 시도해 주세요." };
}

export function QrCheckinKiosk() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const processingRef = useRef(false);
  const [mode, setMode] = useState<ScannerMode>("initializing");
  const [view, setView] = useState<CheckinResultView>(IDLE_CHECKIN_VIEW);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [remainingCount, setRemainingCount] = useState<number | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);

  useEffect(() => {
    // URL을 읽는 동안 카메라와 요청을 시작하지 않고, hydration 뒤 링크 확인 화면을 준비한다.
    const timer = window.setTimeout(() => {
      const token = tokenFromCheckinQr(window.location.href);
      window.history.replaceState(window.history.state, "", "/checkin");
      setLinkToken(token);
      setMode(token ? "confirming" : "scanning");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const showTimedResult = useCallback((nextView: CheckinResultView, nextWarnings: string[] = [], nextRemainingCount: number | null = null) => {
    setLinkToken(null);
    setView(nextView);
    setWarnings(nextWarnings);
    setRemainingCount(nextRemainingCount);
    setMode("showing");
  }, []);

  const submitToken = useCallback(async (token: string) => {
    setView(PROCESSING_VIEW);
    setWarnings([]);
    setMode("processing");

    try {
      const response = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!response.ok && response.status !== 429) throw new Error("Check-in request failed");
      const result = await response.json() as CheckinResult;
      showTimedResult(checkinResultView(result), checkinWarningLabels(result.warning_codes), result.remaining_count);
    } catch {
      showTimedResult(CHECKIN_REQUEST_ERROR_VIEW);
    }
  }, [showTimedResult]);

  useEffect(() => {
    if (mode !== "showing") return;

    const timeout = window.setTimeout(() => {
      processingRef.current = false;
      setView(IDLE_CHECKIN_VIEW);
      setWarnings([]);
      setRemainingCount(null);
      setMode("scanning");
      router.replace("/checkin");
    }, 5000);

    return () => window.clearTimeout(timeout);
  }, [mode, router]);

  useEffect(() => {
    if (mode !== "scanning") return;

    let disposed = false;
    const reader = new BrowserQRCodeReader(undefined, {
      delayBetweenScanAttempts: 250,
      delayBetweenScanSuccess: 1000,
    });

    async function startScanner() {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !videoRef.current) {
          throw new DOMException("Camera requires a secure context", "SecurityError");
        }

        const controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: "user" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          videoRef.current,
          (result, _error, controls) => {
            if (!result || disposed || processingRef.current) return;

            processingRef.current = true;
            controls.stop();
            const token = tokenFromCheckinQr(result.getText());

            if (!token) {
              showTimedResult(INVALID_SCANNED_QR_VIEW);
              return;
            }

            void submitToken(token);
          },
        );

        if (disposed) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      } catch (error) {
        if (disposed) return;
        setView(cameraErrorView(error));
        setWarnings([]);
        setMode("camera_error");
      }
    }

    void startScanner();

    return () => {
      disposed = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [mode, showTimedResult, submitToken]);

  function retryCamera() {
    processingRef.current = false;
    setView(IDLE_CHECKIN_VIEW);
    setWarnings([]);
    setMode("scanning");
  }

  const cameraActive = mode === "scanning";

  return (
    <main className="qr-checkin-screen">
      <header className="qr-checkin-header">
        <Link aria-label="대시보드 홈으로 이동" className="qr-checkin-brand" href="/dashboard">
          <Image alt="" aria-hidden="true" height={56} priority src="/dashboard-brand-logo.png" width={56} />
          <div><strong>조탁구 아카데미</strong><span>레슨 출석 관리</span></div>
        </Link>
        <CheckinClock />
      </header>

      <div className="qr-checkin-stage">
        <section className="qr-scanner-card">
          <div className="qr-scanner-heading"><h1>QR 출석 체크</h1><p>회원 QR 코드를 카메라에 보여주세요</p></div>
          <div className={`qr-camera-frame ${view.tone !== "idle" ? view.tone : ""}`}>
            <video className={cameraActive ? "active" : ""} muted playsInline ref={videoRef} />
            <i className="qr-corner top-left" /><i className="qr-corner top-right" />
            <i className="qr-corner bottom-left" /><i className="qr-corner bottom-right" />
            {!cameraActive && <div className="qr-code-symbol" aria-hidden="true"><span>▣</span><span>▦</span></div>}
            {cameraActive && <div className="qr-scan-line" />}
            {mode === "confirming" && linkToken && <button className="qr-camera-retry" onClick={() => { if (!processingRef.current) { processingRef.current = true; void submitToken(linkToken); } }} type="button">출석 요청 보내기</button>}
            {mode === "camera_error" && <button className="qr-camera-retry" onClick={retryCamera} type="button">카메라 다시 시도</button>}
          </div>
          <p className="qr-camera-guide">{mode === "confirming" ? "버튼을 누르면 출석 요청이 전송됩니다" : mode === "initializing" ? "출석 화면을 준비하고 있습니다" : cameraActive ? "QR 코드를 사각형 안에 맞춰주세요" : mode === "processing" ? "QR 정보를 확인하고 있습니다" : "5초 후 다시 인식합니다"}</p>
        </section>

        <aside className={`qr-result-card ${view.tone}`} aria-live="polite">
          <span className="qr-result-symbol" aria-hidden="true">{view.symbol}</span>
          <h2>{view.title}</h2><strong className="qr-result-message">{view.message}</strong>
          {remainingCount !== null && <div className={`qr-result-remaining${remainingCount <= 2 ? " low" : ""}`}><span>현재 레슨권 잔여</span><strong>{remainingCount}회</strong></div>}
          {warnings.length > 0 && <div className="qr-result-warnings">{warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}
          <div className="qr-result-status"><span>◷</span><p>{view.status}</p></div>
          <p className="qr-reset-guide">{mode === "showing" ? "5초 후 처음 화면으로 돌아갑니다" : mode === "camera_error" ? "카메라 상태를 확인해 주세요" : "QR 코드를 기다리고 있습니다"}</p>
        </aside>
      </div>
      <p className="qr-checkin-help">QR 인식이 안 되면 관장님께 문의해 주세요</p>
    </main>
  );
}
