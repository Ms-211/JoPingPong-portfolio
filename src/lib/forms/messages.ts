import { ZodError } from "zod";

export function errorMessage(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "입력값을 확인해 주세요.";
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return "처리 중 오류가 발생했습니다.";
}

export function withMessage(
  path: string,
  kind: "error" | "success",
  message: string,
) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${kind}=${encodeURIComponent(message)}`;
}
