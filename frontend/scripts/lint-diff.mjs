// 바뀐 TS 파일의 린트 문제 수를 원본(HEAD)과 비교한다. 늘어난 파일이 있으면 exit 1.
// 이 저장소엔 원래 있던 린트 오류가 많아서 "0개"가 아니라 "늘었는가"로 본다.
// 사용: node scripts/lint-diff.mjs   (frontend 폴더에서)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { ESLint } from "eslint";

const git = (args) =>
  execFileSync("git", ["-c", "core.quotePath=false", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });

const files = git(["status", "--porcelain", "--untracked-files=all", "--", "src"])
  .split("\n")
  .map((line) => line.slice(3).trim())
  .filter(Boolean)
  .map((path) => path.replace(/^frontend\//, ""))
  .filter((path) => /\.(ts|tsx)$/.test(path) && !path.includes("__verify_orig") && existsSync(path));

if (files.length === 0) {
  console.log("바뀐 TS 파일 없음");
  process.exit(0);
}

const eslint = new ESLint();
const count = (results) => results.reduce((sum, r) => sum + r.errorCount + r.warningCount, 0);

let worse = 0;
for (const file of files) {
  if (!existsSync(file)) continue;
  const now = count(await eslint.lintText(readFileSync(file, "utf8"), { filePath: file }));
  let before = 0;
  try {
    const original = git(["show", `HEAD:frontend/${file}`]);
    before = count(await eslint.lintText(original, { filePath: file }));
  } catch {
    before = 0; // 새 파일
  }
  const mark = now > before ? "✗" : " ";
  if (now > before) worse += 1;
  console.log(`${mark} ${file.padEnd(58)} ${String(before).padStart(3)} → ${String(now).padStart(3)}`);
}

console.log(worse ? `\n린트 문제가 늘어난 파일 ${worse}개` : "\n늘어난 파일 없음");
process.exit(worse ? 1 : 0);
