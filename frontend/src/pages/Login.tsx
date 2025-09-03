import { useState } from "react";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 👉 나중에 백엔드 연동
    console.log("로그인 시도:", form);
  };

  return (
    <section className="pt-32 min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-800">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-800/70 backdrop-blur-md p-10 rounded-2xl shadow-xl w-full max-w-md text-white"
      >
        <h2 className="text-3xl font-extrabold text-center mb-8">로그인</h2>

        <div className="mb-6">
          <label className="block mb-2">이메일</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            className="w-full p-3 rounded bg-gray-900 text-white focus:outline-none"
            required
          />
        </div>

        <div className="mb-6">
          <label className="block mb-2">비밀번호</label>
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

        <p className="text-center text-gray-400 mt-6">
          아직 계정이 없으신가요?{" "}
          <a href="/register" className="text-pink-400 hover:underline">
            회원가입
          </a>
        </p>
      </form>
    </section>
  );
}
