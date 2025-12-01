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

async function loginRequest(body: any, path: string) {
  const response = await fetch(`${API_BASE}/api/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "로그인에 실패했습니다.");
  }
  return response.json() as Promise<LoginResponse>;
}

function storeSession(data: LoginResponse) {
  localStorage.setItem("token", data.token);
  localStorage.setItem(
    "user",
    JSON.stringify({
      email: data.email,
      nickname: data.nickname,
      role: data.role,
    })
  );
}

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [googleReady, setGoogleReady] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await loginRequest(form, "login");
      storeSession(data);
      alert(`로그인 성공! 환영합니다 ${data.nickname}님`);
      window.location.href = "/";
    } catch (err: any) {
      alert(err?.message || "로그인에 실패했습니다.");
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    try {
      const data = await loginRequest({ idToken: credential }, "google");
      storeSession(data);
      alert(`Google 로그인 성공! 환영합니다 ${data.nickname}님`);
      window.location.href = "/";
    } catch (err: any) {
      alert(err?.message || "Google 로그인에 실패했습니다.");
    }
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setGoogleReady(true);
    document.body.appendChild(script);

    return () => {
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
    window.google.accounts.id.renderButton(
      document.getElementById("googleSignInButton"),
      { theme: "outline", size: "large", width: 320 }
    );
  }, [googleReady]);

  return (
    <section className="pt-32 min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-800">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-800/70 backdrop-blur-md p-10 rounded-2xl shadow-xl w-full max-w-md text-white space-y-6"
      >
        <h2 className="text-3xl font-extrabold text-center mb-2">로그인</h2>
        <p className="text-center text-gray-400 text-sm">이메일/비밀번호 또는 Google로 로그인하세요.</p>

        <div className="space-y-2">
          <label className="block">이메일</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            className="w-full p-3 rounded bg-gray-900 text-white focus:outline-none"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="block">비밀번호</label>
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            className="w-full p-3 rounded bg-gray-900 text-white focus:outline-none"
            required
          />
        </div>

        <button
          type="submit"
          className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white py-3 rounded-lg font-semibold hover:opacity-90 transition"
        >
          로그인
        </button>

        <div className="flex items-center gap-3 text-gray-400 text-sm">
          <div className="flex-1 h-px bg-gray-700" />
          <span>또는</span>
          <div className="flex-1 h-px bg-gray-700" />
        </div>

        <div className="flex justify-center">
          {GOOGLE_CLIENT_ID ? (
            <div id="googleSignInButton" />
          ) : (
            <p className="text-sm text-gray-400">
              Google Client ID가 설정되지 않았습니다. 환경변수 VITE_GOOGLE_CLIENT_ID를 입력해주세요.
            </p>
          )}
        </div>

        <p className="text-center text-gray-400">
          아직 계정이 없으신가요?{" "}
          <a href="/register" className="text-pink-400 hover:underline">
            회원가입
          </a>
        </p>
      </form>
    </section>
  );
}
