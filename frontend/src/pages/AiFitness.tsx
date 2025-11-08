import { useState } from "react";

export default function AiFitness() {
  const [form, setForm] = useState({
    height: "",
    weight: "",
    bodyFat: "",
    muscleMass: "",
  });

  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/ai/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(form),
        credentials: import.meta.env.VITE_USE_CREDENTIALS === "true" ? "include" : "same-origin",
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `HTTP ${res.status}`);
      }

      const data: { explanation: string } = await res.json();
      setResult(data.explanation);
    } catch (err: any) {
      setError(err?.message || "AI 분석 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="pt-32 p-12 bg-gradient-to-br from-gray-900 via-black to-gray-800 min-h-screen text-white">
      <h2 className="text-4xl font-extrabold mb-12 text-center">AI 운동 분석</h2>

      <form onSubmit={handleSubmit} className="max-w-lg mx-auto bg-gray-800/70 p-8 rounded-2xl shadow space-y-6">
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

      {loading && <p className="text-center text-gray-300 mt-8">AI가 분석 중입니다...</p>}
      {error && <p className="text-center text-red-400 mt-8">{error}</p>}
      {result && (
        <div className="max-w-lg mx-auto mt-10 bg-gray-800/70 p-6 rounded-2xl shadow">
          <h3 className="text-2xl font-bold mb-4">AI 분석 가이드</h3>
          <pre className="whitespace-pre-wrap text-gray-300">{result}</pre>
        </div>
      )}
    </section>
  );
}

