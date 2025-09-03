import { useState } from "react";

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      alert("비밀번호가 일치하지 않습니다!");
      return;
    }
    // 👉 나중에 백엔드 연동
    console.log("회원가입 시도:", form);
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
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            className="w-full p-3 rounded bg-gray-900 text-white focus:outline-none"
            required
          />
        </div>

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

        <div className="mb-6">
          <label className="block mb-2">비밀번호 확인</label>
          <input
            type="password"
            name="confirm"
            value={form.confirm}
            onChange={handleChange}
            className="w-full p-3 rounded bg-gray-900 text-white focus:outline-none"
            required
          />
        </div>

        <button
          type="submit"
          className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white py-3 rounded-lg font-semibold hover:opacity-90 transition"
        >
          회원가입
        </button>

        <p className="text-center text-gray-400 mt-6">
          이미 계정이 있으신가요?{" "}
          <a href="/login" className="text-pink-400 hover:underline">
            로그인
          </a>
        </p>
      </form>
    </section>
  );
}
