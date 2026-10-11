// 서버 오류를 사용자에게 보여 줄 한국어 문장으로 바꾼다.
// "HTTP 500", 서버 원문(JSON·스택), 영어 메시지를 화면에 그대로 내보내지 않기 위한 공용 규칙.
//
//   if (!res.ok) throw await httpError(res, "글을 불러오지 못했어요.");
//   catch (e) { setError(friendlyError(e, "글을 불러오지 못했어요.")); }

const BY_STATUS: Record<number, string> = {
  400: "입력한 내용을 다시 확인해 주세요.",
  401: "로그인이 필요해요. 다시 로그인해 주세요.",
  403: "이 작업을 할 권한이 없어요.",
  404: "찾는 내용이 없어요. 지워졌거나 주소가 바뀌었을 수 있어요.",
  409: "이미 처리된 요청이에요.",
  413: "파일이 너무 커요. 더 작은 파일로 올려 주세요.",
  429: "요청이 너무 많아요. 잠시 뒤에 다시 시도해 주세요.",
};

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** 서버가 준 한국어 message 는 살리고, 그 밖의 원문은 상태 코드별 문장으로 바꾼다 */
export async function httpError(res: Response, fallback: string): Promise<HttpError> {
  let serverMessage = "";
  try {
    const raw = await res.text();
    const parsed = JSON.parse(raw) as { message?: unknown };
    if (typeof parsed.message === "string") serverMessage = parsed.message;
  } catch {
    /* 본문이 JSON 이 아니면 쓰지 않는다 */
  }
  const usable = serverMessage && /[가-힣]/.test(serverMessage) && serverMessage.length <= 120;
  return new HttpError(res.status, usable ? serverMessage : BY_STATUS[res.status] ?? (res.status >= 500 ? `${fallback} 잠시 뒤에 다시 시도해 주세요.` : fallback));
}

/** axios 오류(err.response.status · data.message)면 그 상태 코드 */
export function errorStatus(err: unknown): number | null {
  if (err instanceof HttpError) return err.status;
  const status = (err as { response?: { status?: unknown } } | null)?.response?.status;
  return typeof status === "number" ? status : null;
}

/** catch 한 아무 값을 화면용 문장으로 (fetch 의 HttpError · axios 오류 모두) */
export function friendlyError(err: unknown, fallback: string): string {
  if (err instanceof HttpError) return err.message;
  const axiosRes = (err as { response?: { status?: unknown; data?: { message?: unknown } } } | null)?.response;
  if (axiosRes && typeof axiosRes.status === "number") {
    const serverMessage = typeof axiosRes.data?.message === "string" ? axiosRes.data.message : "";
    if (serverMessage && /[가-힣]/.test(serverMessage) && serverMessage.length <= 120) return serverMessage;
    return BY_STATUS[axiosRes.status] ?? (axiosRes.status >= 500 ? `${fallback} 잠시 뒤에 다시 시도해 주세요.` : fallback);
  }
  if (err instanceof TypeError) return "서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.";
  const msg = err instanceof Error ? err.message : "";
  if (msg && /[가-힣]/.test(msg) && msg.length <= 120 && !/HTTP \d{3}/.test(msg)) return msg;
  return fallback;
}
