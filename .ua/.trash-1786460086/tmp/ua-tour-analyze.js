#!/usr/bin/env node
'use strict';

const fs = require('fs');

function main() {
  const inPath = process.argv[2];
  const outPath = process.argv[3];
  if (!inPath || !outPath) throw new Error('usage: node ua-tour-analyze.js <input.json> <output.json>');

  const data = JSON.parse(fs.readFileSync(inPath, 'utf8'));
  const nodes = data.nodes || [];
  const edges = data.edges || [];
  const layers = data.layers || [];

  const byId = new Map();
  nodes.forEach(n => byId.set(n.id, n));

  // --- fan in / fan out ---
  const fanIn = new Map();
  const fanOut = new Map();
  nodes.forEach(n => { fanIn.set(n.id, 0); fanOut.set(n.id, 0); });
  for (const e of edges) {
    if (fanOut.has(e.source)) fanOut.set(e.source, fanOut.get(e.source) + 1);
    if (fanIn.has(e.target)) fanIn.set(e.target, fanIn.get(e.target) + 1);
  }
  const nm = id => (byId.get(id) || {}).name || id;

  const fanInRanking = [...fanIn.entries()]
    .map(([id, v]) => ({ id, fanIn: v, name: nm(id) }))
    .sort((a, b) => b.fanIn - a.fanIn).slice(0, 20);
  const fanOutRanking = [...fanOut.entries()]
    .map(([id, v]) => ({ id, fanOut: v, name: nm(id) }))
    .sort((a, b) => b.fanOut - a.fanOut).slice(0, 20);

  // --- entry point candidates ---
  const ENTRY_NAMES = new Set(['index.ts','index.js','index.tsx','main.ts','main.tsx','main.js','app.ts','app.tsx','app.js','server.ts','server.js','mod.rs','main.go','main.py','main.rs','manage.py','app.py','wsgi.py','asgi.py','run.py','__main__.py','Application.java','Main.java','Program.cs','config.ru','index.php','App.swift','Application.kt','main.cpp','main.c']);

  const foSorted = [...fanOut.values()].sort((a, b) => b - a);
  const fiSorted = [...fanIn.values()].sort((a, b) => a - b);
  const foTop10 = foSorted[Math.floor(foSorted.length * 0.1)] || 0;
  const fiBot25 = fiSorted[Math.floor(fiSorted.length * 0.25)] || 0;

  const entryScores = [];
  for (const n of nodes) {
    let score = 0;
    const fp = (n.filePath || '').replace(/\\/g, '/');
    const depth = fp.split('/').length;
    if (n.type === 'document') {
      if (/^README\.md$/i.test(fp)) score += 5;
      else if (depth === 1 && /\.md$/i.test(fp)) score += 2;
    } else {
      const base = fp.split('/').pop() || n.name;
      if (ENTRY_NAMES.has(base) || /Application\.java$/.test(base)) score += 3;
      if (depth <= 2) score += 1;
      if (fanOut.get(n.id) >= foTop10 && foTop10 > 0) score += 1;
      if (fanIn.get(n.id) <= fiBot25) score += 1;
    }
    if (score > 0) entryScores.push({ id: n.id, score, name: n.name, type: n.type, summary: n.summary });
  }
  entryScores.sort((a, b) => b.score - a.score || (fanOut.get(b.id) - fanOut.get(a.id)));
  const entryPointCandidates = entryScores.slice(0, 12);

  // --- BFS from top code entry point ---
  const adj = new Map();
  for (const e of edges) {
    if (e.type !== 'imports' && e.type !== 'calls') continue;
    if (!adj.has(e.source)) adj.set(e.source, new Set());
    adj.get(e.source).add(e.target);
  }
  function bfs(start) {
    const order = [], depthMap = {};
    if (!byId.has(start)) return { startNode: start, order, depthMap, byDepth: {} };
    const q = [start]; depthMap[start] = 0;
    while (q.length) {
      const cur = q.shift();
      order.push(cur);
      for (const nx of (adj.get(cur) || [])) {
        if (!(nx in depthMap) && byId.has(nx)) { depthMap[nx] = depthMap[cur] + 1; q.push(nx); }
      }
    }
    const byDepth = {};
    for (const [id, d] of Object.entries(depthMap)) { (byDepth[d] = byDepth[d] || []).push(id); }
    return { startNode: start, order, depthMap, byDepth };
  }

  const codeEntry = entryPointCandidates.find(c => c.type !== 'document');
  const bfsTraversal = bfs(codeEntry ? codeEntry.id : (nodes[0] || {}).id);

  // extra BFS roots for multi-service projects
  const extraRoots = ['file:frontend/src/main.tsx', 'file:frontend/src/App.tsx',
    'file:backend/src/main/java/com/ajou/muscleup/BackendApplication.java',
    'file:realtime/src/server.ts'].filter(id => byId.has(id));
  const additionalTraversals = extraRoots.map(bfs);

  // --- non-code inventory ---
  const cat = { documentation: [], infrastructure: [], data: [], config: [] };
  for (const n of nodes) {
    const rec = { id: n.id, name: n.name, type: n.type, filePath: n.filePath, summary: n.summary };
    if (n.type === 'document') cat.documentation.push(rec);
    else if (['service', 'pipeline', 'resource'].includes(n.type)) cat.infrastructure.push(rec);
    else if (['table', 'schema', 'endpoint'].includes(n.type)) cat.data.push(rec);
    else if (n.type === 'config') cat.config.push(rec);
  }

  // --- clusters ---
  const pairKey = (a, b) => (a < b ? a + '||' + b : b + '||' + a);
  const pairCount = new Map();
  const dirSet = new Set();
  for (const e of edges) {
    if (!['imports', 'calls', 'implements', 'inherits', 'depends_on'].includes(e.type)) continue;
    dirSet.add(e.source + '>>' + e.target);
    pairKey(e.source, e.target);
    pairCount.set(pairKey(e.source, e.target), (pairCount.get(pairKey(e.source, e.target)) || 0) + 1);
  }
  const seeds = [];
  for (const [k, c] of pairCount) {
    const [a, b] = k.split('||');
    const bidir = dirSet.has(a + '>>' + b) && dirSet.has(b + '>>' + a);
    if (bidir || c >= 2) seeds.push({ nodes: [a, b], edgeCount: c, bidir });
  }
  // undirected neighbor map for expansion
  const und = new Map();
  for (const e of edges) {
    if (!['imports', 'calls', 'implements', 'inherits', 'depends_on'].includes(e.type)) continue;
    if (!und.has(e.source)) und.set(e.source, new Set());
    if (!und.has(e.target)) und.set(e.target, new Set());
    und.get(e.source).add(e.target); und.get(e.target).add(e.source);
  }
  const clusters = [];
  const used = new Set();
  seeds.sort((a, b) => b.edgeCount - a.edgeCount);
  for (const s of seeds) {
    if (s.nodes.some(n => used.has(n))) continue;
    const members = new Set(s.nodes);
    const cand = new Map();
    for (const m of s.nodes) for (const nb of (und.get(m) || [])) {
      if (!members.has(nb)) cand.set(nb, (cand.get(nb) || 0) + 1);
    }
    [...cand.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1])
      .slice(0, 3).forEach(([id]) => members.add(id));
    let ec = 0;
    for (const e of edges) if (members.has(e.source) && members.has(e.target)) ec++;
    clusters.push({ nodes: [...members].slice(0, 5), edgeCount: ec });
    [...members].forEach(m => used.add(m));
    if (clusters.length >= 10) break;
  }

  // --- summary index ---
  const nodeSummaryIndex = {};
  for (const n of nodes) nodeSummaryIndex[n.id] = { name: n.name, type: n.type, filePath: n.filePath, summary: n.summary };

  const out = {
    scriptCompleted: true,
    entryPointCandidates,
    fanInRanking,
    fanOutRanking,
    bfsTraversal,
    additionalTraversals,
    nonCodeFiles: cat,
    clusters,
    layers: { count: layers.length, list: layers },
    nodeSummaryIndex,
    totalNodes: nodes.length,
    totalEdges: edges.length
  };
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log('OK nodes=%d edges=%d clusters=%d bfsStart=%s bfsReached=%d',
    nodes.length, edges.length, clusters.length, bfsTraversal.startNode, bfsTraversal.order.length);
}

try { main(); } catch (err) { console.error(err && err.stack || String(err)); process.exit(1); }
