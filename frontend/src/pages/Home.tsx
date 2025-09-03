import { useState, useEffect } from "react";

// 이미지 import
import shark from "../assets/images/상어.png";
import jaegun from "../assets/images/재건이형.jpg";


const images = [
  shark,
  "https://images.unsplash.com/photo-1517836357463-d25dfeac3438",
  jaegun,
];

export default function Home() {
  const [currentIndex, setCurrentIndex] = useState(0);

  // ⏳ 일정 시간마다 이미지 변경
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 5000); // 5초마다 변경
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative w-full h-screen flex bg-gradient-to-br from-gray-900 via-black to-gray-800 overflow-hidden">
      {/* 좌측: 텍스트 영역 */}
      <div className="flex-1 flex flex-col justify-center pl-20 pr-10 text-left z-10">
        <h1 className="text-6xl md:text-7xl font-extrabold text-white leading-tight">
          득근에서 <br />
          <span className="bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
            함께 성장
          </span>
          하세요
        </h1>

        <p className="mt-6 text-lg md:text-xl text-gray-300 max-w-md">
          운동 커뮤니티의 <span className="text-pink-400 font-semibold">새로운 기준 🚀</span>
          <br />
          프로틴 공동구매 · 헬스장 후기 · 임원진 소개
        </p>

        <div className="mt-10 flex gap-4">
          <a
            href="/protein"
            className="px-6 py-3 rounded-lg text-lg font-semibold bg-pink-500 text-white hover:bg-pink-600 transition shadow-lg"
          >
            지금 시작하기
          </a>
          <a
            href="/reviews"
            className="px-6 py-3 rounded-lg text-lg font-semibold border border-gray-400 text-white hover:bg-gray-800 transition"
          >
            후기 보기
          </a>
        </div>
      </div>

      {/* 우측: 이미지 영역 */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {images.map((src, index) => (
          <img
            key={index}
            src={src}
            alt="운동 이미지"
            className={`absolute transition-opacity duration-1000 ease-in-out w-full h-full object-cover ${
              index === currentIndex ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
