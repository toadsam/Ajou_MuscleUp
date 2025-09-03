import { useState } from "react";

export default function AiFitness() {
  const [form, setForm] = useState({
    height: "",
    weight: "",
    bodyFat: "",
    muscleMass: "",
  });

  const [result, setResult] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 👉 실제로는 백엔드 + AI API 연동
    // 지금은 간단히 로직만 예시
    const bmi = Number(form.weight) / Math.pow(Number(form.height) / 100, 2);
    let advice = "";

    if (bmi > 25) {
      advice += "체중 감량이 필요합니다. 하루 500kcal 적게 섭취하세요.\n";
    } else if (bmi < 18.5) {
      advice += "체중 증가가 필요합니다. 단백질 위주의 식단을 추천합니다.\n";
    } else {
      advice += "정상 체중 범위입니다. 꾸준한 운동을 유지하세요.\n";
    }

    advice += "유산소 운동 시 심박수는 최대심박수의 60~75%가 유리합니다.\n";
    advice += "단백질:체지방률(%) × 1.2g/day 정도 섭취를 추천합니다.";

    setResult(advice);
  };

  return (
    <section className="pt-32 p-12 bg-gradient-to-br from-gray-900 via-black to-gray-800 min-h-screen text-white">
      <h2 className="text-4xl font-extrabold mb-12 text-center">🤖 AI득근</h2>

      <form
        onSubmit={handleSubmit}
        className="max-w-lg mx-auto bg-gray-800/70 p-8 rounded-2xl shadow space-y-6"
      >
        <div>
          <label className="block mb-2">키 (cm)</label>
          <input
            type="number"
            name="height"
            value={form.height}
            onChange={handleChange}
            className="w-full p-3 rounded bg-gray-900 text-white"
            required
          />
        </div>
        <div>
          <label className="block mb-2">체중 (kg)</label>
          <input
            type="number"
            name="weight"
            value={form.weight}
            onChange={handleChange}
            className="w-full p-3 rounded bg-gray-900 text-white"
            required
          />
        </div>
        <div>
          <label className="block mb-2">체지방률 (%)</label>
          <input
            type="number"
            name="bodyFat"
            value={form.bodyFat}
            onChange={handleChange}
            className="w-full p-3 rounded bg-gray-900 text-white"
          />
        </div>
        <div>
          <label className="block mb-2">골격근량 (kg)</label>
          <input
            type="number"
            name="muscleMass"
            value={form.muscleMass}
            onChange={handleChange}
            className="w-full p-3 rounded bg-gray-900 text-white"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white py-3 rounded-lg font-semibold hover:opacity-90 transition"
        >
          분석하기
        </button>
      </form>

      {result && (
        <div className="max-w-lg mx-auto mt-10 bg-gray-800/70 p-6 rounded-2xl shadow">
          <h3 className="text-2xl font-bold mb-4">맞춤형 AI 피드백</h3>
          <pre className="whitespace-pre-wrap text-gray-300">{result}</pre>
        </div>
      )}
    </section>
  );
}
