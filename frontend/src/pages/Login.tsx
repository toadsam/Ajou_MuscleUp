import { useState } from "react";

interface LoginResponse {
  token: string;
  email: string;
  nickname: string;
  role: string;
}

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch(
  `${import.meta.env.VITE_API_BASE}/api/auth/login`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  }
);

      if (response.ok) {
        const data: LoginResponse = await response.json();

        // ✅ 토큰 저장
        localStorage.setItem("token", data.token);

        // ✅ 유저 정보 저장
        localStorage.setItem(
          "user",
          JSON.stringify({
            email: data.email,
            nickname: data.nickname,
            role: data.role,
          })
        );

        alert(`로그인 성공! 환영합니다 ${data.nickname}님 🎉`);

        // 로그인 후 메인 페이지로 이동
        window.location.href = "/";
      } else {
        const error = await response.text();
        alert("로그인 실패: " + error);
      }
    } catch (err) {
      alert("서버와 연결할 수 없습니다. 😢");
    }
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
