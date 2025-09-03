import { useState } from "react";

export default function WriteReview() {
  const [form, setForm] = useState({
    user: "",
    gym: "",
    stars: 5,
    text: "",
    image: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("작성된 리뷰:", form);
    alert("리뷰가 등록되었습니다!");
    // 👉 나중에 여기서 백엔드 API POST 호출
  };

  return (
    <section className="pt-32 p-12 min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white">
      <div className="max-w-2xl mx-auto bg-gray-800/70 backdrop-blur-md p-8 rounded-2xl shadow-xl">
        <h2 className="text-3xl font-bold mb-8 text-center">리뷰 작성</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block mb-2">닉네임</label>
            <input
              type="text"
              name="user"
              value={form.user}
              onChange={handleChange}
              className="w-full border border-gray-600 rounded p-3 bg-gray-900 text-white focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block mb-2">헬스장 이름</label>
            <input
              type="text"
              name="gym"
              value={form.gym}
              onChange={handleChange}
              className="w-full border border-gray-600 rounded p-3 bg-gray-900 text-white focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block mb-2">별점</label>
            <input
              type="number"
              name="stars"
              value={form.stars}
              onChange={handleChange}
              min="1"
              max="5"
              className="w-full border border-gray-600 rounded p-3 bg-gray-900 text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block mb-2">후기</label>
            <textarea
              name="text"
              value={form.text}
              onChange={handleChange}
              className="w-full border border-gray-600 rounded p-3 bg-gray-900 text-white h-32 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block mb-2">사진 URL</label>
            <input
              type="text"
              name="image"
              value={form.image}
              onChange={handleChange}
              className="w-full border border-gray-600 rounded p-3 bg-gray-900 text-white focus:outline-none"
              placeholder="이미지 주소를 입력하세요"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white py-3 rounded-lg font-semibold hover:opacity-90 transition"
          >
            등록하기
          </button>
        </form>
      </div>
    </section>
  );
}
