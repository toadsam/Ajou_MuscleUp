import { useEffect, useState } from "react";

interface LoginResponse {
  token: string;
  email: string;
  nickname: string;
  role: string;
}

declare global {
  interface Window {
    google?: any;
  }
}

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

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

    if (!GOOGLE_CLIENT_ID) return;

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
  }, []);

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
    <section className="pt-32 min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-800">
      <div className="bg-gray-800/70 backdrop-blur-md p-10 rounded-2xl shadow-xl w-full max-w-md text-white space-y-6">
        <h2 className="text-3xl font-extrabold text-center mb-2">Google 로그인</h2>
        <p className="text-center text-gray-400 text-sm">Google 계정으로 빠르게 시작하세요.</p>

        <label className="flex items-center gap-2 text-sm text-gray-200 justify-center">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          자동 로그인
        </label>

        <div className="flex justify-center min-h-[42px] items-center">
          {GOOGLE_CLIENT_ID ? (
            <div id="googleSignInButton" />
          ) : (
            <p className="text-sm text-gray-400">Google Client ID가 설정되지 않았습니다.</p>
          )}
        </div>

        {googleLoadFailed && (
          <div className="space-y-3">
            <p className="text-center text-xs text-gray-400">
              현재 브라우저 환경에서 Google 버튼을 불러오지 못했습니다.
            </p>
            <button
              type="button"
              className="w-full bg-white text-gray-900 py-3 rounded-lg font-semibold hover:bg-gray-100 transition"
              onClick={startGoogleFallbackLogin}
            >
              Google 로그인 계속하기
            </button>
          </div>
        )}

        {/* 회원가입 문구 임시 비활성화 */}
      </div>
    </section>
  );
}
