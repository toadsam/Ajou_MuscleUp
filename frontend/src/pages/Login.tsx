import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { friendlyError, httpError } from "../lib/httpError";
import { toast } from "../lib/toast";

interface LoginResponse {
  token: string;
  email: string;
  nickname: string;
  role: string;
  /** 서버는 이제 리프레시 토큰을 httpOnly 쿠키로만 준다(본문 값은 항상 null). 저장하지 않는다. */
  refreshToken?: string | null;
}

declare global {
  interface Window {
    google?: any;
  }
}

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";
const FRONTEND_BASE_URL = import.meta.env.VITE_FRONTEND_BASE_URL ?? "https://musclehub.co.kr";

function isSafariBrowser() {
  const ua = navigator.userAgent;
  const hasSafari = /Safari/i.test(ua);
  const excluded = /Chrome|CriOS|EdgiOS|FxiOS|OPiOS|SamsungBrowser/i.test(ua);
  return hasSafari && !excluded;
}

// 카카오톡·인스타그램·페이스북·라인·네이버 앱 안 브라우저, 안드로이드 WebView(`; wv)`).
// Google 은 이런 화면에서 로그인을 막는다(disallowed_useragent).
const IN_APP_UA = /KAKAOTALK|Instagram|FBAN|FBAV|FB_IAB|\bLine\/|NAVER\(inapp|DaumApps|; wv\)/;

function detectInApp() {
  const ua = navigator.userAgent;
  return {
    inApp: IN_APP_UA.test(ua),
    kakao: /KAKAOTALK/.test(ua),
    android: /Android/i.test(ua),
    ios: /iPhone|iPad|iPod/i.test(ua),
  };
}

// 로그인 뒤 돌아갈 곳. 구글 리디렉트(안정 모드)로 화면을 떠났다 돌아와도 남도록 sessionStorage 에 둔다.
const RETURN_KEY = "login_return_to";

/** 같은 사이트 안의 경로만 허용한다. 외부 주소·"//host"·로그인 화면 자신은 버린다. */
function safeReturnPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    if (url.pathname === "/login" || url.pathname === "/register") return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function readStoredReturn(): string | null {
  try {
    return safeReturnPath(sessionStorage.getItem(RETURN_KEY));
  } catch {
    return null;
  }
}

function writeStoredReturn(path: string | null) {
  try {
    if (path) sessionStorage.setItem(RETURN_KEY, path);
    else sessionStorage.removeItem(RETURN_KEY);
  } catch {
    /* 저장소를 못 쓰면 홈으로 돌아간다 */
  }
}

async function loginRequest(body: Record<string, unknown>, path: string) {
  const response = await fetch(`${API_BASE}/api/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw await httpError(response, "로그인하지 못했어요.");
  }
  return response.json() as Promise<LoginResponse>;
}

function storeSession(data: LoginResponse) {
  localStorage.setItem(
    "user",
    JSON.stringify({
      accessToken: data.token,
      email: data.email,
      nickname: data.nickname,
      role: data.role,
    })
  );
}

export default function Login() {
  const [rememberMe, setRememberMe] = useState(true);
  const [googleReady, setGoogleReady] = useState(false);
  const [googleLoadFailed, setGoogleLoadFailed] = useState(false);
  const isSafari = isSafariBrowser();
  const { inApp, kakao, android, ios } = detectInApp();
  const location = useLocation();
  const fromRegister = new URLSearchParams(location.search).get("from") === "register";

  // 돌아갈 곳: ProtectedRoute 가 넘긴 state.from → ?next= → (구글 리디렉트에서 돌아온 경우) 저장해 둔 값 → 홈
  const [returnTo] = useState<string>(() => {
    const requested =
      safeReturnPath((location.state as { from?: unknown } | null)?.from) ??
      safeReturnPath(new URLSearchParams(location.search).get("next"));
    if (requested) {
      writeStoredReturn(requested);
      return requested;
    }
    const returningFromGoogle = window.location.hash.includes("id_token=");
    if (!returningFromGoogle) writeStoredReturn(null); // 예전에 그만둔 로그인의 값이 남지 않게
    return (returningFromGoogle && readStoredReturn()) || "/";
  });

  const externalLoginUrl = `${FRONTEND_BASE_URL.replace(/\/+$/, "")}/login${
    returnTo !== "/" ? `?next=${encodeURIComponent(returnTo)}` : ""
  }`;

  const handleGoogleCredential = async (credential: string, remember = rememberMe) => {
    try {
      const data = await loginRequest({ idToken: credential, rememberMe: remember }, "google");
      storeSession(data);
      const target = readStoredReturn() ?? returnTo;
      writeStoredReturn(null);
      // 헤더·라운지 등이 새 로그인 상태를 처음부터 읽도록 새로 불러온다(같은 사이트 경로만 들어온다)
      window.location.replace(target);
    } catch (err) {
      toast(friendlyError(err, "Google 로그인에 실패했어요. 다시 시도해 주세요."), "error");
    }
  };

  const startGoogleFallbackLogin = () => {
    if (!GOOGLE_CLIENT_ID) {
      toast("지금은 Google 로그인을 쓸 수 없어요. 잠시 뒤에 다시 시도해 주세요.", "error");
      return;
    }

    const nonce = crypto.randomUUID();
    sessionStorage.setItem("google_oauth_nonce", nonce);
    sessionStorage.setItem("google_remember_me", rememberMe ? "1" : "0");

    const redirectUri = `${window.location.origin}/login`;
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "id_token");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("nonce", nonce);
    url.searchParams.set("prompt", "select_account");

    window.location.href = url.toString();
  };

  const openInExternalBrowser = () => {
    const target = externalLoginUrl;
    if (kakao) {
      // 카카오톡이 제공하는 "기본 브라우저로 열기" 주소(안드로이드·iOS 공통)
      window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(target)}`;
      return;
    }
    if (android) {
      const stripped = target.replace(/^https?:\/\//, "");
      window.location.href = `intent://${stripped}#Intent;scheme=https;package=com.android.chrome;end`;
      return;
    }
    window.open(target, "_blank", "noopener,noreferrer");
  };

  const copyLoginLink = async () => {
    try {
      await navigator.clipboard.writeText(externalLoginUrl);
      toast("링크를 복사했어요. Safari 주소창에 붙여 넣어 주세요.", "success");
    } catch {
      toast("복사하지 못했어요. 아래 주소를 길게 눌러 복사해 주세요.", "error");
    }
  };

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const idTokenFromHash = hash.get("id_token");
    if (idTokenFromHash) {
      const remembered = sessionStorage.getItem("google_remember_me") === "1";
      setRememberMe(remembered);
      void handleGoogleCredential(idTokenFromHash, remembered);
      window.history.replaceState(null, "", "/login");
      sessionStorage.removeItem("google_oauth_nonce");
      sessionStorage.removeItem("google_remember_me");
      return;
    }

    if (!GOOGLE_CLIENT_ID || isSafari) {
      if (isSafari) setGoogleLoadFailed(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setGoogleReady(true);
    script.onerror = () => setGoogleLoadFailed(true);
    document.body.appendChild(script);

    const timeout = window.setTimeout(() => {
      if (!window.google) setGoogleLoadFailed(true);
    }, 4000);

    return () => {
      window.clearTimeout(timeout);
      document.body.removeChild(script);
    };
  }, [isSafari]);

  useEffect(() => {
    if (!googleReady || !window.google || !GOOGLE_CLIENT_ID) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response: any) => {
        if (response.credential) {
          handleGoogleCredential(response.credential);
        }
      },
    });
    window.google.accounts.id.renderButton(document.getElementById("googleSignInButton"), {
      theme: "outline",
      size: "large",
      width: 320,
    });
  }, [googleReady, rememberMe]);

  return (
    <section className="flex min-h-screen items-center justify-center px-4 pb-16 pt-32">
      <div className="dg-steel dg-rise relative w-full max-w-md space-y-6 overflow-hidden px-6 pb-8 pt-9 text-chalk sm:px-10">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-2 border-b-2 border-black bg-plate-red" />
        <div className="text-center">
          <p className="font-num text-sm tracking-[0.12em] text-steel-400">SIGN IN</p>
          <h2 className="mt-1 font-display text-3xl text-chalk">Google 로그인</h2>
          <p className="mt-2 text-sm text-steel-300">Google 계정으로 빠르게 시작하세요.</p>
        </div>

        {fromRegister && (
          <p className="dg-well break-keep px-4 py-3 text-sm leading-relaxed text-steel-200">
            득근득근은 따로 회원가입하지 않아요. Google 계정으로 처음 로그인하면 그대로 가입돼요.
          </p>
        )}

        {/* 앱 안 브라우저(카카오톡 등)에서는 Google 이 로그인을 막으므로, 버튼보다 먼저 바깥 브라우저 안내를 보여 준다 */}
        {inApp && (
          <div className="dg-well space-y-3 border-l-[6px] border-l-plate-yellow p-4 text-left">
            <p className="break-keep font-semibold text-plate-yellow">이 화면에서는 Google 로그인이 막혀 있어요</p>
            <p className="break-keep text-sm leading-relaxed text-steel-300">
              카카오톡·인스타그램 같은 앱 안에서 열린 화면은 Google 이 로그인을 허용하지 않아요.
              {ios && !kakao ? " Safari 로 열어서 로그인해 주세요." : " 바깥 브라우저로 열어서 로그인해 주세요."}
            </p>
            {(android || kakao) && (
              <button type="button" className="dg-btn dg-btn-primary w-full py-3 text-sm" onClick={openInExternalBrowser}>
                {kakao ? "기본 브라우저로 열기" : "Chrome으로 열기"}
              </button>
            )}
            {ios && (
              <>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-steel-300">
                  <li className="break-keep">화면 아래나 위의 ··· 또는 공유 버튼을 눌러요.</li>
                  <li className="break-keep">"Safari로 열기" 또는 "다른 브라우저로 열기"를 골라요.</li>
                  <li className="break-keep">메뉴가 없으면 아래 링크를 복사해 Safari 주소창에 붙여 넣어요.</li>
                </ol>
                <button type="button" className="dg-btn dg-btn-steel w-full py-3 text-sm" onClick={() => void copyLoginLink()}>
                  로그인 링크 복사
                </button>
                <input
                  readOnly
                  value={externalLoginUrl}
                  aria-label="로그인 링크"
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full rounded-md border-2 border-black bg-steel-900 px-3 py-2 font-num text-xs text-steel-200"
                />
              </>
            )}
          </div>
        )}

        <label className="flex cursor-pointer items-center justify-center gap-2 text-sm text-steel-300">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 accent-plate-red"
          />
          자동 로그인
        </label>

        {/* 구글 버튼이 철판 위에 혼자 떠 보이지 않도록 밝은 받침 칸에 끼워 둔다 */}
        <div className="rounded-lg border-[3px] border-black bg-chalk px-3 py-4 shadow-md">
          <div className="flex min-h-[44px] items-center justify-center">
            {GOOGLE_CLIENT_ID && !isSafari ? (
              <div id="googleSignInButton" className="max-w-full overflow-hidden" />
            ) : (
              <p className="text-center text-sm text-steel-700">
                {GOOGLE_CLIENT_ID ? "Safari에서는 안정 모드 로그인을 사용합니다." : "지금은 Google 로그인을 준비하고 있어요. 잠시 뒤에 다시 와 주세요."}
              </p>
            )}
          </div>

          {googleLoadFailed && (
            <div className="mt-3 space-y-3 border-t-2 border-dashed border-steel-300 pt-3">
              <p className="text-center text-xs text-steel-600">
                {isSafari
                  ? "Safari 안정 모드로 로그인합니다."
                  : "현재 브라우저 환경에서 Google 버튼을 불러오지 못했습니다."}
              </p>
              {inApp ? (
                <button
                  type="button"
                  className="dg-btn w-full bg-white py-3 text-sm text-black"
                  onClick={openInExternalBrowser}
                >
                  외부 브라우저에서 로그인 열기
                </button>
              ) : (
                <button
                  type="button"
                  className="dg-btn w-full bg-white py-3 text-sm text-black"
                  onClick={startGoogleFallbackLogin}
                >
                  Google 로그인 계속하기
                </button>
              )}
            </div>
          )}
        </div>

        <p className="break-keep text-center text-xs text-steel-400">
          처음이라면 Google 로그인만 하면 가입까지 끝나요.
        </p>
      </div>
    </section>
  );
}
