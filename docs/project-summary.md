# JoPingPong 프로젝트 요약

QR 출석 요청을 코치가 확인한 뒤 레슨권을 차감하고, 오승인 복구와 처리 이력까지 연결하는 내부 업무 시스템입니다. 실제 운영에 사용한 프로젝트의 별도 공개본이며 기획·설계·개발·배포를 개인이 담당했습니다.

## 주요 경험

- 방문 요청과 실제 레슨 승인을 구분하는 업무 흐름 설계
- 회원·개별 등록권·승인 기록의 관계형 데이터 모델링
- DB 잠금·상태 검사·원래 차감권 복구·감사 이력 구현
- Next.js 서버와 Supabase Auth·RLS·Storage 연결
- Vitest·pgTAP·GitHub Actions로 앱과 DB 검사 구성
- Codex·ChatGPT를 활용한 개발

## 기능과 기술

회원·8회권 관리, QR 발급·체크인, 일괄 승인·거절, 취소 복구, 과거 레슨 입력, 당일 운영 경고, 기록 조회·CSV를 제공합니다.

Next.js 16 · React 19 · TypeScript · Supabase PostgreSQL/Auth/Storage · RLS · PL/pgSQL · Zod · qrcode · @zxing/browser · Cloudflare Workers · OpenNext · Vitest · pgTAP

## 공개 범위

운영 데이터·기존 Git 이력을 제외했습니다. 운영 서비스 주소는 README에 안내하며 관계자 계정이 필요합니다. 샘플 계정과 회원은 로컬 전용이며 운영으로 자동 배포하지 않습니다. 측정하지 않은 처리량·업무 시간 절감은 성과로 기재하지 않습니다.

[README](../README.md) · [DB 설계](database.md) · [문제 해결](troubleshooting.md)

