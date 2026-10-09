"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

type QrPreviewProps = {
  name: string;
  phone: string | null;
  url: string;
};

export function QrPreview({ name, phone, url }: QrPreviewProps) {
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  const printCard = (
    <article className="qr-print-card" aria-hidden="true">
      <header className="qr-print-card-brand-title">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" src="/dashboard-brand-logo.png" />
        <div>
          <strong>조탁구 아카데미</strong>
          <span>LESSON ATTENDANCE</span>
        </div>
      </header>

      <section className="qr-print-card-member">
        <strong>{name}</strong>
        <p>{phone || "전화번호 미등록"}</p>
        <small>회원 출석 카드</small>
      </section>

      <div className="qr-print-card-code">
        {/* Private, short-lived Supabase signed URL. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={`${name} 회원 출석 QR`} src={url} />
      </div>
    </article>
  );

  async function loadImage(source: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = source;
    });
  }

  async function downloadCard(orientation: "landscape" | "portrait") {
    let qrObjectUrl: string | null = null;
    let logoObjectUrl: string | null = null;

    try {
      const [qrResponse, logoResponse] = await Promise.all([
        fetch(url),
        fetch("/dashboard-brand-logo.png"),
      ]);

      if (!qrResponse.ok || !logoResponse.ok) {
        throw new Error("Card asset download failed");
      }

      qrObjectUrl = URL.createObjectURL(await qrResponse.blob());
      logoObjectUrl = URL.createObjectURL(await logoResponse.blob());

      const [qrImage, logoImage] = await Promise.all([
        loadImage(qrObjectUrl),
        loadImage(logoObjectUrl),
      ]);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Canvas is unavailable");
      }

      const portrait = orientation === "portrait";
      canvas.width = portrait ? 638 : 1011;
      canvas.height = portrait ? 1011 : 638;

      context.fillStyle = "#ffffff";
      context.beginPath();
      context.roundRect(8, 8, canvas.width - 16, canvas.height - 16, 38);
      context.fill();

      const borderGradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
      borderGradient.addColorStop(0, "#ed171d");
      borderGradient.addColorStop(0.38, "#ed171d");
      borderGradient.addColorStop(0.62, "#07182e");
      borderGradient.addColorStop(1, "#07182e");
      context.strokeStyle = borderGradient;
      context.lineWidth = 14;
      context.beginPath();
      context.roundRect(8, 8, canvas.width - 16, canvas.height - 16, 38);
      context.stroke();

      if (portrait) {
        context.drawImage(logoImage, 42, 32, 126, 126);
        context.fillStyle = "#07182e";
        context.font = '800 38px "Malgun Gothic", Arial, sans-serif';
        context.fillText("조탁구 아카데미", 188, 84);
        context.fillStyle = "#6d7885";
        context.font = '800 16px "Malgun Gothic", Arial, sans-serif';
        context.fillText("LESSON ATTENDANCE", 190, 117);

        context.strokeStyle = "#dfe4e9";
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(44, 182);
        context.lineTo(594, 182);
        context.stroke();

        context.fillStyle = "#07182e";
        context.font = '800 58px "Malgun Gothic", Arial, sans-serif';
        context.fillText(name, 54, 274);
        context.fillStyle = "#26384b";
        context.font = '800 30px "Malgun Gothic", Arial, sans-serif';
        context.fillText(phone || "전화번호 미등록", 56, 329);
        context.fillStyle = "#07182e";
        context.font = '800 30px "Malgun Gothic", Arial, sans-serif';
        context.fillText("회원 출석 카드", 56, 382);

        context.fillStyle = "#ffffff";
        context.beginPath();
        context.roundRect(54, 421, 530, 530, 26);
        context.fill();
        context.imageSmoothingEnabled = false;
        context.drawImage(qrImage, 78, 445, 482, 482);
      } else {
        context.drawImage(logoImage, 54, 30, 138, 138);
        context.fillStyle = "#07182e";
        context.font = '800 44px "Malgun Gothic", Arial, sans-serif';
        context.fillText("조탁구 아카데미", 218, 91);
        context.fillStyle = "#6d7885";
        context.font = '800 18px "Malgun Gothic", Arial, sans-serif';
        context.fillText("LESSON ATTENDANCE", 220, 126);

        context.strokeStyle = "#dfe4e9";
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(48, 190);
        context.lineTo(963, 190);
        context.stroke();

        context.fillStyle = "#07182e";
        context.font = '800 66px "Malgun Gothic", Arial, sans-serif';
        context.fillText(name, 70, 315);
        context.fillStyle = "#26384b";
        context.font = '800 34px "Malgun Gothic", Arial, sans-serif';
        context.fillText(phone || "전화번호 미등록", 72, 375);
        context.fillStyle = "#07182e";
        context.font = '800 34px "Malgun Gothic", Arial, sans-serif';
        context.fillText("회원 출석 카드", 72, 493);

        context.fillStyle = "#ffffff";
        context.beginPath();
        context.roundRect(622, 215, 342, 342, 22);
        context.fill();
        context.imageSmoothingEnabled = false;
        context.drawImage(qrImage, 636, 229, 314, 314);
      }

      const imageBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Image encoding failed")), "image/png");
      });
      const objectUrl = URL.createObjectURL(imageBlob);
      const link = document.createElement("a");
      const safeName = name.replace(/[\\/:*?"<>|]/g, "_").trim() || "회원";

      link.href = objectUrl;
      link.download = `${safeName}_${portrait ? "세로" : "가로"}_출석카드.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.alert("출석 카드 이미지를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      if (qrObjectUrl) URL.revokeObjectURL(qrObjectUrl);
      if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl);
    }
  }

  return (
    <div className="qr-preview">
      <div className="qr-screen-preview">
        {/* Private, short-lived Supabase signed URL. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={`${name} 회원 QR`} src={url} />
      </div>

      <div className="form-actions no-print">
        <button className="button-link" onClick={() => downloadCard("landscape")} type="button">
          가로 카드 저장
        </button>
        <button className="button-link" onClick={() => downloadCard("portrait")} type="button">
          세로 카드 저장
        </button>
        <button className="secondary-button compact-button" onClick={() => window.print()} type="button">
          카드 인쇄
        </button>
      </div>

      {mounted && createPortal(printCard, document.body)}
    </div>
  );
}
