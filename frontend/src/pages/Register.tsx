import { useState } from "react";
import { useNavigate } from "react-router-dom";

const BASE = import.meta.env.VITE_API_BASE ?? "";
const REGISTER_PATH = import.meta.env.VITE_REGISTER_PATH ?? "/api/users/register";
const USE_CREDENTIALS = (import.meta.env.VITE_USE_CREDENTIALS ?? "false") === "true";

// 슬래시 중복/누락 방지
const join = (base: string, path: string) =>
  `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    nickname: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [emailCode, setEmailCode] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const apiBase = BASE ? `${BASE}` : "";
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const codeOk = /^\d{6}$/.test(emailCode.trim());

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    if (name === "email") setEmailVerified(false); // 이메일 바꾸면 다시 인증 필요
  };

  const validate = () => {
    if (!form.name.trim()) return "이름을 입력해주세요.";
    if (!emailOk) return "이메일 형식이 올바르지 않습니다.";
    if (form.password.length < 8) return "비밀번호는 8자 이상이어야 합니다.";
    if (form.password !== form.confirm) return "비밀번호가 일치하지 않습니다!";
    if (!emailVerified) return "이메일 인증을 완료해주세요.";
    return null;
  };

  const parseErr = async (res: Response, fallback: string) => {
    const t = await res.text().catch(() => "");
    try {
      const j = JSON.parse(t);
      return j.message || j.error || fallback;
    } catch {
      return t || fallback;
    }
  };

  const sendCode = async () => {
    setErr(null);
    if (!emailOk) { setErr("유효한 이메일을 먼저 입력하세요."); return; }
    setEmailSending(true);
    try {
      const url = join(apiBase, "/api/auth/email/send-code");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: USE_CREDENTIALS ? "include" : "same-origin",
        body: JSON.stringify({ email: form.email.trim().toLowerCase() }),
      });
      if (!res.ok) throw new Error(await parseErr(res, "인증코드 전송에 실패했습니다."));
      alert("인증코드를 이메일로 보냈습니다. 10분 내에 입력하세요.");
    } catch (e: any) {
      setErr(e?.message ?? "인증코드 전송 실패");
    } finally {
      setEmailSending(false);
    }
  };

  const verifyCode = async () => {
    setErr(null);
    if (!codeOk) { setErr("인증코드는 6자리 숫자입니다."); return; }
    setVerifying(true);
    try {
      const url = join(apiBase, "/api/auth/email/verify");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: USE_CREDENTIALS ? "include" : "same-origin",
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          code: emailCode.trim(),
        }),
      });
      if (!res.ok) throw new Error(await parseErr(res, "인증 실패"));
      setEmailVerified(true);
      alert("이메일 인증 완료!");
    } catch (e: any) {
      setEmailVerified(false);
      setErr(e?.message ?? "인증 실패");
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (v) { setErr(v); return; }

    setErr(null);
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        ...(form.nickname.trim() && { nickname: form.nickname.trim() }),
      };

      const url = BASE ? join(BASE, REGISTER_PATH) : REGISTER_PATH;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: USE_CREDENTIALS ? "include" : "same-origin",
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await parseErr(res, `HTTP ${res.status}`));

      alert("회원가입이 완료되었습니다!");
      navigate("/login");
    } catch (e: any) {
      setErr(e?.message ?? "회원가입에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="pt-32 min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-800">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-800/70 backdrop-blur-md p-10 rounded-2xl shadow-xl w-full max-w-md text-white"
      >
        <h2 className="text-3xl font-extrabold text-center mb-8">회원가입</h2>

        <div className="mb-6">
          <label className="block mb-2">이름</label>
          <input
            type="text" name="name" value={form.name} onChange={handleChange}
            className="w-full p-3 rounded bg-gray-900 text-white focus:outline-none"
            autoComplete="name" required
          />
        </div>

        <div className="mb-6">
          <label className="block mb-2">닉네임 (선택)</label>
          <input
            type="text" name="nickname" value={form.nickname} onChange={handleChange}
            className="w-full p-3 rounded bg-gray-900 text-white focus:outline-none"
            autoComplete="nickname" maxLength={30}
          />
        </div>

        <div className="mb-4">
          <label className="block mb-2">이메일</label>
          <div className="flex gap-2">
            <input
              type="email" name="email" value={form.email} onChange={handleChange}
              className="flex-1 p-3 rounded bg-gray-900 text-white focus:outline-none"
              autoComplete="email" required
              readOnly={emailVerified} // 인증 완료 후 오입력 방지(원하면 제거)
            />
            <button
              type="button" onClick={sendCode}
              disabled={emailSending || !emailOk}
              className="px-3 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60"
            >
              {emailSending ? "전송중..." : "인증코드 전송"}
            </button>
          </div>
        </div>

        <div className="mb-6">
          <label className="block mb-2">이메일 인증코드</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={emailCode}
              onChange={(e)=>setEmailCode(e.target.value)}
              className="flex-1 p-3 rounded bg-gray-900 text-white focus:outline-none"
              placeholder="6자리 코드"
              inputMode="numeric" pattern="\d{6}" maxLength={6}
              autoComplete="one-time-code"
            />
            <button
              type="button" onClick={verifyCode}
              disabled={verifying || !codeOk}
              className="px-3 rounded bg-green-600 hover:bg-green-500 disabled:opacity-60"
            >
              {verifying ? "확인중..." : "확인"}
            </button>
          </div>
          {emailVerified && <p className="text-green-400 text-sm mt-2">인증 완료</p>}
        </div>

        <div className="mb-6">
          <label className="block mb-2">비밀번호</label>
          <input
            type="password" name="password" value={form.password} onChange={handleChange}
            className="w-full p-3 rounded bg-gray-900 text-white focus:outline-none"
            autoComplete="new-password" required minLength={8}
          />
        </div>

        <div className="mb-2">
          <label className="block mb-2">비밀번호 확인</label>
          <input
            type="password" name="confirm" value={form.confirm} onChange={handleChange}
            className="w-full p-3 rounded bg-gray-900 text-white focus:outline-none"
            autoComplete="new-password" required minLength={8}
          />
        </div>

        {err && <p className="text-red-400 text-sm mb-4 whitespace-pre-line">{err}</p>}

        <button
          type="submit"
          disabled={submitting || !emailVerified}
          className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-60"
        >
          {submitting ? "가입 중..." : "회원가입"}
        </button>

        <p className="text-center text-gray-400 mt-6">
          이미 계정이 있으신가요?{" "}
          <a href="/login" className="text-pink-400 hover:underline">로그인</a>
        </p>
      </form>
    </section>
  );
}
