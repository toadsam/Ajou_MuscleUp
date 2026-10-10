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

  const inputClass =
    "w-full rounded-md border-2 border-black bg-steel-900 p-3 text-chalk placeholder:text-steel-500 transition focus:outline-none focus-visible:border-plate-yellow read-only:opacity-70";

  return (
    <section className="flex min-h-screen items-center justify-center px-4 pb-16 pt-32">
      <form
        onSubmit={handleSubmit}
        className="dg-steel dg-rise relative w-full max-w-md overflow-hidden px-6 pb-8 pt-10 text-chalk sm:px-10"
      >
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-2 border-b-2 border-black bg-plate-red" />
        <div className="mb-8 text-center">
          <p className="font-num text-sm tracking-[0.12em] text-steel-400">JOIN</p>
          <h2 className="mt-1 font-display text-3xl text-chalk">회원가입</h2>
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm font-semibold text-steel-300">이름</label>
          <input
            type="text" name="name" value={form.name} onChange={handleChange}
            className={inputClass}
            autoComplete="name" required
          />
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm font-semibold text-steel-300">
            닉네임 <span className="font-normal text-steel-500">(선택)</span>
          </label>
          <input
            type="text" name="nickname" value={form.nickname} onChange={handleChange}
            className={inputClass}
            autoComplete="nickname" maxLength={30}
          />
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-sm font-semibold text-steel-300">이메일</label>
          <div className="flex gap-2">
            <input
              type="email" name="email" value={form.email} onChange={handleChange}
              className={`${inputClass} min-w-0 flex-1`}
              autoComplete="email" required
              readOnly={emailVerified} // 인증 완료 후 오입력 방지(원하면 제거)
            />
            <button
              type="button" onClick={sendCode}
              disabled={emailSending || !emailOk}
              className="dg-btn dg-btn-steel shrink-0 px-3 text-sm"
            >
              {emailSending ? "전송중..." : "인증코드 전송"}
            </button>
          </div>
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm font-semibold text-steel-300">이메일 인증코드</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={emailCode}
              onChange={(e)=>setEmailCode(e.target.value)}
              className={`${inputClass} min-w-0 flex-1 font-num text-lg tracking-[0.3em]`}
              placeholder="6자리 코드"
              inputMode="numeric" pattern="\d{6}" maxLength={6}
              autoComplete="one-time-code"
            />
            <button
              type="button" onClick={verifyCode}
              disabled={verifying || !codeOk}
              className={`dg-btn shrink-0 px-4 text-sm ${emailVerified ? "bg-plate-green text-white" : "dg-btn-steel"}`}
            >
              {verifying ? "확인중..." : "확인"}
            </button>
          </div>
          {emailVerified && (
            <p className="dg-pop mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-green-400">
              <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-black bg-plate-green text-white" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5L19 7" />
                </svg>
              </span>
              인증 완료
            </p>
          )}
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm font-semibold text-steel-300">비밀번호</label>
          <input
            type="password" name="password" value={form.password} onChange={handleChange}
            className={inputClass}
            autoComplete="new-password" required minLength={8}
          />
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-sm font-semibold text-steel-300">비밀번호 확인</label>
          <input
            type="password" name="confirm" value={form.confirm} onChange={handleChange}
            className={inputClass}
            autoComplete="new-password" required minLength={8}
          />
        </div>

        {err && (
          <p className="mb-4 whitespace-pre-line rounded-md border-2 border-black bg-red-950 px-3 py-2 text-sm text-red-300" role="alert">
            {err}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !emailVerified}
          className="dg-btn dg-btn-primary w-full py-3"
        >
          {submitting ? "가입 중..." : "회원가입"}
        </button>

        <p className="mt-6 text-center text-steel-400">
          이미 계정이 있으신가요?{" "}
          <a href="/login" className="font-semibold text-red-400 underline-offset-4 hover:underline">로그인</a>
        </p>
      </form>
    </section>
  );
}
