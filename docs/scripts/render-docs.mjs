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
  },
  {
    input: "docs/user-guide.md",
    output: "docs/user-guide.html",
    pdf: "docs/user-guide.pdf",
    title: "득근득근 사용 설명서",
  },
];

const escapeHtml = (value) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function inline(text) {
  return escapeHtml(text)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function renderMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  let html = "";
  let inList = false;
  let inCode = false;
  let codeLang = "";
  let codeBuffer = [];

  const closeList = () => {
    if (inList) {
      html += "</ul>\n";
      inList = false;
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
        closeList();
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
      closeList();
      continue;
    }

    if (/^#{1,6}\s/.test(line)) {
      closeList();
      const level = line.match(/^#+/)[0].length;
      const text = line.replace(/^#{1,6}\s+/, "");
      const id = text
        .toLowerCase()
        .replace(/<[^>]+>/g, "")
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-|-$/g, "");
      html += `<h${level} id="${id}">${inline(text)}</h${level}>\n`;
      continue;
    }

    if (line.startsWith("|") && lines[i + 1]?.startsWith("|") && /\|[\s:-]+\|/.test(lines[i + 1])) {
      closeList();
      const headers = line.split("|").slice(1, -1).map((cell) => cell.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        rows.push(lines[i].split("|").slice(1, -1).map((cell) => cell.trim()));
        i += 1;
      }
      i -= 1;
      html += "<table><thead><tr>";
      headers.forEach((header) => {
        html += `<th>${inline(header)}</th>`;
      });
      html += "</tr></thead><tbody>";
      rows.forEach((row) => {
        html += "<tr>";
        row.forEach((cell) => {
          html += `<td>${inline(cell)}</td>`;
        });
        html += "</tr>";
      });
      html += "</tbody></table>\n";
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        html += "<ul>\n";
        inList = true;
      }
      html += `<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>\n`;
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      closeList();
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      i -= 1;
      html += "<ol>\n";
      items.forEach((item) => {
        html += `<li>${inline(item)}</li>\n`;
      });
      html += "</ol>\n";
      continue;
    }

    closeList();
    const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      html += `<figure><img src="${escapeHtml(imageMatch[2])}" alt="${escapeHtml(imageMatch[1])}"><figcaption>${escapeHtml(imageMatch[1])}</figcaption></figure>\n`;
    } else {
      html += `<p>${inline(line)}</p>\n`;
    }
  }

  closeList();
  if (inCode) flushCode();
  return html;
}

function toc(markdown) {
  return markdown
    .split(/\r?\n/)
    .filter((line) => /^##\s+/.test(line))
    .map((line) => {
      const text = line.replace(/^##\s+/, "");
      const id = text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-|-$/g, "");
      return `<a href="#${id}">${escapeHtml(text)}</a>`;
    })
    .join("");
}

function wrapHtml({ title, markdown, body }) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; --ink:#182032; --muted:#59657a; --line:#dfe4ee; --soft:#f6f8fb; --brand:#1054d4; }
    * { box-sizing: border-box; }
    body { margin:0; background:#edf1f7; color:var(--ink); font-family: "Pretendard", "Noto Sans KR", "Apple SD Gothic Neo", Arial, sans-serif; line-height:1.72; }
    .page { max-width:1120px; margin:0 auto; background:#fff; min-height:100vh; box-shadow:0 18px 80px rgba(20,34,62,.12); }
    .cover { padding:56px 68px 36px; border-bottom:1px solid var(--line); background:linear-gradient(135deg,#10172a,#1f3b73); color:white; }
    .cover p { max-width:760px; color:#d9e4ff; margin:12px 0 0; }
    .content { padding:36px 68px 72px; }
    nav.toc { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; margin:0 0 36px; padding:18px; background:var(--soft); border:1px solid var(--line); border-radius:12px; }
    nav.toc a { color:#254166; text-decoration:none; font-size:14px; padding:6px 8px; border-radius:8px; }
    nav.toc a:hover { background:#fff; }
    h1 { margin:0; font-size:42px; line-height:1.15; letter-spacing:0; }
    h2 { margin:42px 0 14px; padding-top:4px; border-top:2px solid var(--line); font-size:24px; line-height:1.35; }
    h3 { margin:28px 0 10px; font-size:19px; color:#102c5d; }
    p { margin:10px 0; }
    ul, ol { padding-left:24px; margin:10px 0 18px; }
    li { margin:5px 0; }
    table { width:100%; border-collapse:collapse; margin:16px 0 26px; font-size:14px; }
    th, td { border:1px solid var(--line); padding:10px 12px; vertical-align:top; }
    th { background:#eef4ff; color:#17345d; text-align:left; }
    code { background:#eef2f7; border:1px solid #dce3ef; border-radius:5px; padding:1px 5px; font-size:.92em; }
    pre { overflow:auto; background:#101827; color:#e9f0ff; padding:16px; border-radius:12px; }
    pre code { background:transparent; border:0; color:inherit; padding:0; }
    figure { margin:22px 0 34px; break-inside:avoid; }
    figure img, p > img { display:block; width:100%; max-width:960px; border:1px solid var(--line); border-radius:10px; box-shadow:0 14px 42px rgba(20,34,62,.13); }
    figcaption { margin-top:8px; color:var(--muted); font-size:13px; text-align:center; }
    strong { color:#0f2f67; }
    @page { size:A4; margin:13mm; }
    @media print {
      body { background:white; }
      .page { box-shadow:none; max-width:none; }
      .cover, .content { padding-left:0; padding-right:0; }
      nav.toc { grid-template-columns:repeat(2,minmax(0,1fr)); }
      h2 { break-after:avoid; }
      figure img, p > img { max-height:62vh; object-fit:contain; }
    }
  </style>
</head>
<body>
  <article class="page">
    <section class="cover">
      <h1>${escapeHtml(title)}</h1>
      <p>실제 코드, API, 라우트, 데이터 모델, 실행 화면을 기준으로 작성한 제출용 문서입니다.</p>
    </section>
    <section class="content">
      <nav class="toc">${toc(markdown)}</nav>
      ${body}
    </section>
  </article>
</body>
</html>`;
}

for (const doc of docs) {
  const markdown = await fs.readFile(doc.input, "utf8");
  const html = wrapHtml({ title: doc.title, markdown, body: renderMarkdown(markdown) });
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
