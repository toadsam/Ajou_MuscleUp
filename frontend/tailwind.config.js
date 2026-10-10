/** @type {import('tailwindcss').Config} */

// 짐 플로어(v2) 팔레트.
// 기존 화면의 색 클래스(slate·cyan·pink 등)를 그대로 두고, 각 색 계열이
// 헬스장 소재 색으로 보이도록 팔레트 자체를 다시 정의한다.
const steel = {
  50: "#F4F2EC",
  100: "#EEECE6",
  200: "#D9D8D3",
  300: "#BDBEC1",
  400: "#A6A8AD",
  500: "#7B7E84",
  600: "#5A5D63",
  700: "#3A3D43",
  800: "#26272B",
  900: "#1A1A1C",
  950: "#0E0E10",
};

// 원판 빨강(25kg) — 주요 행동
const plateRed = {
  50: "#FDF0EF",
  100: "#FADBD8",
  200: "#F5B5B0",
  300: "#EE8A83",
  400: "#E65C53",
  500: "#D9302A",
  600: "#BC2620",
  700: "#961E1A",
  800: "#6F1714",
  900: "#4A100E",
  950: "#2C0907",
};

// 원판 노랑(15kg) — 강조 · 티어 · 보상
const plateYellow = {
  50: "#FEF9E8",
  100: "#FCEFC4",
  200: "#F9E08A",
  300: "#F5CF55",
  400: "#F0BE2E",
  500: "#DDA514",
  600: "#B5850E",
  700: "#8A640C",
  800: "#5F450A",
  900: "#3B2B07",
  950: "#221904",
};

// 원판 초록(10kg) — 성공 · 완료
const plateGreen = {
  50: "#EEF8F1",
  100: "#D3EEDC",
  200: "#A8DCB9",
  300: "#74C690",
  400: "#45AE6B",
  500: "#2E9C55",
  600: "#237E44",
  700: "#1C6236",
  800: "#164A29",
  900: "#0F321C",
  950: "#08200F",
};

// 원판 파랑(20kg) — 정보 · 라운지
const plateBlue = {
  50: "#EEF4FD",
  100: "#D6E4F9",
  200: "#ADC8F2",
  300: "#7EA7E9",
  400: "#5089DD",
  500: "#2F6FD0",
  600: "#2459AD",
  700: "#1D4688",
  800: "#163463",
  900: "#0F2341",
  950: "#091527",
};

const hard = (y) => `0 ${y}px 0 #0E0E10`;
const noBlur = { none: "0", sm: "0", DEFAULT: "0", md: "0", lg: "0", xl: "0", "2xl": "0", "3xl": "0" };

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans KR"', "Pretendard", '"Noto Sans KR"', "sans-serif"],
        heading: ['"Black Han Sans"', '"IBM Plex Sans KR"', "sans-serif"],
        body: ['"IBM Plex Sans KR"', "Pretendard", "sans-serif"],
        display: ['"Black Han Sans"', '"IBM Plex Sans KR"', "sans-serif"],
        num: ['"Big Shoulders Display"', '"IBM Plex Sans KR"', "sans-serif"],
        pen: ['"Nanum Pen Script"', "cursive"],
      },
      colors: {
        black: "#0E0E10",
        steel,
        plate: { red: "#D9302A", blue: "#2F6FD0", yellow: "#F0BE2E", green: "#2E9C55", white: "#E8E6E0" },
        chalk: "#EEECE6",
        board: { DEFAULT: "#F2F1EC", ink: "#1F2A44", blue: "#1D4FA8", red: "#C42B24", frame: "#A3A7AD" },
        brand: { pink: plateRed[500], purple: plateRed[600], indigo: plateRed[700] },

        gray: steel,
        slate: steel,
        zinc: steel,
        neutral: steel,
        stone: steel,

        red: plateRed,
        rose: plateRed,
        pink: plateRed,
        fuchsia: plateRed,
        purple: plateRed,
        violet: plateRed,
        indigo: plateRed,

        cyan: plateYellow,
        amber: plateYellow,
        yellow: plateYellow,
        orange: plateYellow,

        emerald: plateGreen,
        green: plateGreen,
        teal: plateGreen,
        lime: plateGreen,

        sky: plateBlue,
        blue: plateBlue,
      },
      borderRadius: {
        sm: "2px",
        DEFAULT: "4px",
        md: "4px",
        lg: "6px",
        xl: "6px",
        "2xl": "8px",
        "3xl": "10px",
      },
      boxShadow: {
        sm: hard(2),
        DEFAULT: hard(3),
        md: hard(4),
        lg: hard(5),
        xl: hard(6),
        "2xl": hard(6),
        inner: "inset 0 2px 0 rgba(0,0,0,0.35)",
        press: hard(4),
      },
      backdropBlur: noBlur,
    },
  },
  plugins: [],
};
