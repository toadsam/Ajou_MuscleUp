import { useEffect, useState } from "react";

interface LoginResponse {
  token: string;
  email: string;
  nickname: string;
  role: string;
  refreshToken?: string;
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

async function loginRequest(body: Record<string, unknown>, path: string) {
  const response = await fetch(`${API_BASE}/api/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "로그인에 실패했습니다.");
  }
  return response.json() as Promise<LoginResponse>;
}

function storeSession(data: LoginResponse) {
  localStorage.setItem(
    "user",
    JSON.stringify({
      accessToken: data.token,
      refreshToken: data.refreshToken,
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
  const isBlockedUserAgent = /wv|WebView|FBAN|FBAV|Instagram|Line|KAKAOTALK|NAVER|DaumApps/i.test(
    navigator.userAgent
  );

  const handleGoogleCredential = async (credential: string, remember = rememberMe) => {
    try {
      const data = await loginRequest({ idToken: credential, rememberMe: remember }, "google");
      storeSession(data);
      alert(`${data.nickname}님, 환영합니다!`);
      window.location.href = "/";
    } catch (err: any) {
      alert(err?.message || "Google 로그인에 실패했습니다.");
    }
  };

  const startGoogleFallbackLogin = () => {
    if (!GOOGLE_CLIENT_ID) {
      alert("Google Client ID가 설정되지 않았습니다.");
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
    const target = `${FRONTEND_BASE_URL.replace(/\/+$/, "")}/login`;
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) {
      const stripped = target.replace(/^https?:\/\//, "");
      window.location.href = `intent://${stripped}#Intent;scheme=https;package=com.android.chrome;end`;
      return;
    }
    window.open(target, "_blank", "noopener,noreferrer");
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
                {GOOGLE_CLIENT_ID ? "Safari에서는 안정 모드 로그인을 사용합니다." : "Google Client ID가 설정되지 않았습니다."}
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
              {isBlockedUserAgent ? (
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

        {/* 회원가입 문구 임시 비활성화 */}
      </div>
    </section>
  );
}
