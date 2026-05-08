import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const requireFromFrontend = createRequire(path.resolve("frontend/package.json"));
const { chromium } = requireFromFrontend("playwright");

const docs = [
  {
    input: "docs/service-introduction.md",
    output: "docs/service-introduction.html",
    pdf: "docs/service-introduction.pdf",
    title: "득근득근 서비스 소개",
    subtitle: "실제 코드, API, 라우트, DB 구조와 실행 화면을 기준으로 정리한 발표/제출용 서비스 소개 문서입니다.",
    badge: "Service Introduction",
    pills: ["서비스 개요", "주요 기능", "사용자 가치", "시스템 구성"],
  },
  {
    input: "docs/user-guide.md",
    output: "docs/user-guide.html",
    pdf: "docs/user-guide.pdf",
    title: "득근득근 사용 설명서",
    subtitle: "실제 사용자가 화면을 보며 따라 할 수 있도록 기능별 이동 경로와 사용 단계를 정리한 문서입니다.",
    badge: "User Guide",
    pills: ["회원 기능", "관리자 기능", "화면 안내", "FAQ"],
  },
  {
    input: "docs/technical-beginner-guide.md",
    output: "docs/technical-beginner-guide.html",
    pdf: "docs/technical-beginner-guide.pdf",
    title: "득근득근 초보자용 기술 완전 설명서",
    subtitle: "프론트엔드, 백엔드, DB, 인증, API, 관리자 기능, 실시간 서버를 초보자도 이해할 수 있게 풀어쓴 기술 문서입니다.",
    badge: "Technical Beginner Guide",
    pills: ["React", "Spring Boot", "DB", "JWT", "Socket.IO", "API"],
  },
];

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");

function inline(text) {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function renderMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  let html = "";
  let inUl = false;
  let inCode = false;
  let codeLang = "";
  let codeBuffer = [];

  const closeUl = () => {
    if (inUl) {
      html += "</ul>\n";
      inUl = false;
    }
  };

  const flushCode = () => {
    html += `<pre><code class="language-${escapeHtml(codeLang)}">${escapeHtml(codeBuffer.join("\n"))}</code></pre>\n`;
    inCode = false;
    codeLang = "";
    codeBuffer = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCode) {
        flushCode();
      } else {
        closeUl();
        inCode = true;
        codeLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(line);
      continue;
    }

    if (!line.trim()) {
      closeUl();
      continue;
    }

    if (/^#{1,6}\s/.test(line)) {
      closeUl();
      const level = line.match(/^#+/)?.[0].length ?? 1;
      const text = line.replace(/^#{1,6}\s+/, "");
      const id = slugify(text);
      html += `<h${level} id="${id}">${inline(text)}</h${level}>\n`;
      continue;
    }

    if (line.startsWith("|") && lines[i + 1]?.startsWith("|") && /\|[\s:-]+\|/.test(lines[i + 1])) {
      closeUl();
      const headers = line.split("|").slice(1, -1).map((cell) => cell.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        rows.push(lines[i].split("|").slice(1, -1).map((cell) => cell.trim()));
        i += 1;
      }
      i -= 1;
      html += "<table><thead><tr>";
      for (const header of headers) html += `<th>${inline(header)}</th>`;
      html += "</tr></thead><tbody>";
      for (const row of rows) {
        html += "<tr>";
        for (const cell of row) html += `<td>${inline(cell)}</td>`;
        html += "</tr>";
      }
      html += "</tbody></table>\n";
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      if (!inUl) {
        html += "<ul>\n";
        inUl = true;
      }
      html += `<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>\n`;
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      closeUl();
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      i -= 1;
      html += "<ol>\n";
      for (const item of items) html += `<li>${inline(item)}</li>\n`;
      html += "</ol>\n";
      continue;
    }

    if (/^>\s+/.test(line)) {
      closeUl();
      html += `<blockquote>${inline(line.replace(/^>\s+/, ""))}</blockquote>\n`;
      continue;
    }

    closeUl();
    const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      html += `<figure><img src="${escapeHtml(imageMatch[2])}" alt="${escapeHtml(imageMatch[1])}"><figcaption>${escapeHtml(imageMatch[1])}</figcaption></figure>\n`;
    } else {
      html += `<p>${inline(line)}</p>\n`;
    }
  }

  closeUl();
  if (inCode) flushCode();
  return html;
}

function toc(markdown) {
  return markdown
    .split(/\r?\n/)
    .filter((line) => /^##\s+/.test(line))
    .map((line) => {
      const text = line.replace(/^##\s+/, "");
      return `<a href="#${slugify(text)}">${escapeHtml(text)}</a>`;
    })
    .join("");
}

function wrapHtml({ doc, markdown, body }) {
  const pills = doc.pills.map((pill) => `<span>${escapeHtml(pill)}</span>`).join("");
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(doc.title)}</title>
  <style>
    @page { size: A4; margin: 13mm; }
    :root {
      color-scheme: light;
      --ink: #172033;
      --muted: #5d6b82;
      --line: #d8e1ef;
      --soft: #f5f8fc;
      --accent: #0969da;
      --accent-ink: #07488f;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--ink);
      background: #eef3f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", "Apple SD Gothic Neo", Arial, sans-serif;
      line-height: 1.68;
    }
    .page {
      max-width: 1080px;
      margin: 32px auto;
      background: #fff;
      border: 1px solid var(--line);
      box-shadow: 0 18px 50px rgba(18, 38, 63, 0.12);
    }
    .cover {
      padding: 42px 52px 30px;
      border-bottom: 1px solid var(--line);
      background:
        radial-gradient(circle at 88% 18%, rgba(9, 105, 218, 0.16), transparent 28%),
        linear-gradient(135deg, #f8fbff 0%, #eef5ff 100%);
    }
    .cover-badge {
      display: inline-flex;
      align-items: center;
      margin-bottom: 14px;
      padding: 6px 10px;
      border: 1px solid #b8d5fb;
      border-radius: 999px;
      background: #fff;
      color: var(--accent-ink);
      font-size: 12px;
      font-weight: 750;
    }
    .cover p {
      max-width: 760px;
      margin: 10px 0 0;
      color: var(--muted);
      font-size: 15px;
    }
    .cover-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 18px;
    }
    .cover-pills span {
      padding: 7px 10px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: #fff;
      color: #26364d;
      font-size: 12px;
      font-weight: 700;
    }
    main { padding: 30px 52px 52px; }
    h1, h2, h3 { line-height: 1.28; letter-spacing: 0; }
    h1 { margin: 0; font-size: 34px; }
    h2 {
      margin: 40px 0 14px;
      padding-top: 8px;
      border-top: 1px solid var(--line);
      font-size: 23px;
    }
    h3 {
      margin: 28px 0 10px;
      font-size: 18px;
      color: var(--accent-ink);
    }
    p { margin: 10px 0; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    nav.toc {
      margin: 24px 0 8px;
      padding: 18px 20px;
      border: 1px solid var(--line);
      background: var(--soft);
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 4px 18px;
    }
    nav.toc::before {
      content: "목차";
      grid-column: 1 / -1;
      margin-bottom: 8px;
      color: #173b66;
      font-weight: 800;
    }
    nav.toc a {
      color: #254166;
      text-decoration: none;
      font-size: 13px;
      padding: 4px 0;
      break-inside: avoid;
    }
    table {
      width: 100%;
      margin: 16px 0 22px;
      border-collapse: collapse;
      font-size: 14px;
    }
    th, td {
      border: 1px solid var(--line);
      padding: 10px 11px;
      vertical-align: top;
    }
    th {
      background: #edf4ff;
      color: #173b66;
      font-weight: 700;
      text-align: left;
    }
    tr:nth-child(even) td { background: #fafcff; }
    ul, ol { padding-left: 24px; }
    li { margin: 4px 0; }
    strong { font-weight: 750; color: #0f2f67; }
    code {
      padding: 2px 5px;
      border-radius: 4px;
      background: #eef2f7;
      color: #26364d;
      font-family: "Cascadia Code", Consolas, monospace;
      font-size: 0.92em;
    }
    pre {
      margin: 14px 0 20px;
      padding: 14px 16px;
      border: 1px solid #273449;
      border-radius: 8px;
      background: #0f172a;
      color: #e5edf8;
      overflow-x: auto;
      font-family: "Cascadia Code", Consolas, monospace;
      font-size: 13px;
      line-height: 1.55;
    }
    pre code {
      padding: 0;
      border-radius: 0;
      background: transparent;
      color: inherit;
      font-size: inherit;
    }
    figure {
      margin: 20px 0 30px;
      break-inside: avoid;
    }
    figure img {
      display: block;
      width: 100%;
      max-width: 960px;
      height: auto;
      margin: 0 auto;
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: 0 10px 28px rgba(18, 38, 63, 0.12);
    }
    figcaption {
      margin-top: 8px;
      color: var(--muted);
      text-align: center;
      font-size: 13px;
    }
    blockquote {
      margin: 16px 0;
      padding: 12px 16px;
      border-left: 4px solid var(--accent);
      background: var(--soft);
    }
    @media print {
      body { background: #fff; }
      .page { margin: 0; border: 0; box-shadow: none; max-width: none; }
      .cover, main { padding-left: 0; padding-right: 0; }
      h2, h3, figure, table { break-inside: avoid; }
      nav.toc { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      figure img { max-height: 62vh; object-fit: contain; }
    }
    @media (max-width: 780px) {
      .page { margin: 0; border: 0; }
      .cover, main { padding-left: 22px; padding-right: 22px; }
      nav.toc { grid-template-columns: 1fr; }
      h1 { font-size: 28px; }
    }
  </style>
</head>
<body>
  <article class="page">
    <header class="cover">
      <span class="cover-badge">${escapeHtml(doc.badge)}</span>
      <h1>${escapeHtml(doc.title)}</h1>
      <p>${escapeHtml(doc.subtitle)}</p>
      <div class="cover-pills">${pills}</div>
      <nav class="toc">${toc(markdown)}</nav>
    </header>
    <main>
      ${body}
    </main>
  </article>
</body>
</html>`;
}

for (const doc of docs) {
  const markdown = await fs.readFile(doc.input, "utf8");
  const html = wrapHtml({ doc, markdown, body: renderMarkdown(markdown) });
  await fs.writeFile(doc.output, html, "utf8");
}

const browser = await chromium.launch({ headless: true });
try {
  for (const doc of docs) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(pathToFileURL(path.resolve(doc.output)).href, { waitUntil: "load" });
    await page.pdf({
      path: doc.pdf,
      format: "A4",
      printBackground: true,
      margin: { top: "13mm", right: "12mm", bottom: "13mm", left: "12mm" },
    });
    await page.close();
  }
} finally {
  await browser.close();
}
