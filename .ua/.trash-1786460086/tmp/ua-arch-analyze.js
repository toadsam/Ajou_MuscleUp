#!/usr/bin/env node
'use strict';

const fs = require('fs');

function fail(msg) { console.error(msg); process.exit(1); }

const inPath = process.argv[2];
const outPath = process.argv[3];
if (!inPath || !outPath) fail('usage: node ua-arch-analyze.js <input.json> <output.json>');

let data;
try { data = JSON.parse(fs.readFileSync(inPath, 'utf8')); }
catch (e) { fail('failed to parse input: ' + e.message); }

const fileNodes = data.fileNodes || [];
const importEdges = data.importEdges || [];
const allEdges = data.allEdges || [];
if (!fileNodes.length) fail('no fileNodes in input');

const byId = new Map();
fileNodes.forEach(n => byId.set(n.id, n));

const norm = p => String(p || '').replace(/\\/g, '/').replace(/^\.\//, '');

// ---------- A. Directory grouping (common prefix aware) ----------
const paths = fileNodes.map(n => norm(n.filePath));
function commonPrefixDir(list) {
  if (!list.length) return '';
  const split = list.map(p => p.split('/').slice(0, -1));
  let pref = split[0];
  for (const s of split) {
    let i = 0;
    while (i < pref.length && i < s.length && pref[i] === s[i]) i++;
    pref = pref.slice(0, i);
    if (!pref.length) break;
  }
  return pref.length ? pref.join('/') + '/' : '';
}
const prefix = commonPrefixDir(paths);

// Monorepo-aware grouping: service root + meaningful sub-directory.
const SERVICE_ROOTS = ['backend', 'frontend', 'realtime'];
// noise segments to skip when finding the meaningful sub-directory
const SKIP = new Set(['src', 'main', 'test', 'java', 'com', 'ajou', 'muscleup', 'app', 'resources']);

function groupOf(fp) {
  let rel = fp.startsWith(prefix) ? fp.slice(prefix.length) : fp;
  const segs = rel.split('/');
  const fileName = segs[segs.length - 1];
  const dirs = segs.slice(0, -1);
  if (!dirs.length) return '(root)';

  const svc = SERVICE_ROOTS.includes(dirs[0]) ? dirs[0] : null;
  if (!svc) return dirs[0]; // docs, .github, etc.

  const rest = dirs.slice(1);
  // backend test tree
  if (rest[0] === 'src' && rest[1] === 'test') return svc + '/test';
  if (rest[0] === 'src' && rest[1] === 'main' && rest[2] === 'resources') return svc + '/resources';
  let i = 0;
  while (i < rest.length && SKIP.has(rest[i])) i++;
  if (i >= rest.length) return svc + '/(root)';
  // keep one level of nesting for dto/* style subpackages
  return svc + '/' + rest[i];
}

const directoryGroups = {};
const groupByNode = new Map();
fileNodes.forEach(n => {
  const g = groupOf(norm(n.filePath));
  (directoryGroups[g] = directoryGroups[g] || []).push(n.id);
  groupByNode.set(n.id, g);
});

// ---------- B. Node type grouping ----------
const nodeTypeGroups = {};
fileNodes.forEach(n => { (nodeTypeGroups[n.type] = nodeTypeGroups[n.type] || []).push(n.id); });

// ---------- C. Adjacency / fan-in / fan-out ----------
const fileFanIn = {}, fileFanOut = {};
importEdges.forEach(e => {
  if (!byId.has(e.source) || !byId.has(e.target)) return;
  fileFanOut[e.source] = (fileFanOut[e.source] || 0) + 1;
  fileFanIn[e.target] = (fileFanIn[e.target] || 0) + 1;
});

// ---------- D. Cross-category dependency analysis ----------
const ccMap = new Map();
const crossTypeExamples = {};
allEdges.forEach(e => {
  const s = byId.get(e.source), t = byId.get(e.target);
  if (!s || !t) return;
  if (s.type === t.type) return;
  const k = s.type + '|' + t.type + '|' + e.type;
  ccMap.set(k, (ccMap.get(k) || 0) + 1);
  (crossTypeExamples[k] = crossTypeExamples[k] || []);
  if (crossTypeExamples[k].length < 4) crossTypeExamples[k].push(e.source + ' -> ' + e.target);
});
const crossCategoryEdges = [...ccMap.entries()].map(([k, count]) => {
  const [fromType, toType, edgeType] = k.split('|');
  return { fromType, toType, edgeType, count, examples: crossTypeExamples[k] };
}).sort((a, b) => b.count - a.count);

// ---------- E. Inter-group import frequency ----------
const igMap = new Map();
importEdges.forEach(e => {
  const a = groupByNode.get(e.source), b = groupByNode.get(e.target);
  if (!a || !b || a === b) return;
  const k = a + '|' + b;
  igMap.set(k, (igMap.get(k) || 0) + 1);
});
const interGroupImports = [...igMap.entries()].map(([k, count]) => {
  const [from, to] = k.split('|');
  return { from, to, count };
}).sort((a, b) => b.count - a.count);

// ---------- F. Intra-group density ----------
const intraGroupDensity = {};
Object.keys(directoryGroups).forEach(g => { intraGroupDensity[g] = { internalEdges: 0, totalEdges: 0, density: 0 }; });
importEdges.forEach(e => {
  const a = groupByNode.get(e.source), b = groupByNode.get(e.target);
  if (!a || !b) return;
  if (a === b) { intraGroupDensity[a].internalEdges++; intraGroupDensity[a].totalEdges++; }
  else { intraGroupDensity[a].totalEdges++; intraGroupDensity[b].totalEdges++; }
});
Object.keys(intraGroupDensity).forEach(g => {
  const d = intraGroupDensity[g];
  d.density = d.totalEdges ? +(d.internalEdges / d.totalEdges).toFixed(3) : 0;
});

// ---------- G. Pattern matching ----------
const DIR_PATTERNS = [
  [['routes', 'api', 'controllers', 'controller', 'endpoints', 'handlers', 'serializers', 'routers', 'blueprints'], 'api'],
  [['services', 'service', 'core', 'lib', 'domain', 'logic', 'signals', 'composables', 'mailers', 'jobs', 'channels', 'internal', 'scheduler'], 'service'],
  [['models', 'db', 'data', 'persistence', 'repository', 'repositories', 'entities', 'entity', 'migrations', 'sql', 'database'], 'data'],
  [['components', 'views', 'pages', 'ui', 'layouts', 'screens'], 'ui'],
  [['middleware', 'plugins', 'interceptors', 'guards'], 'middleware'],
  [['utils', 'util', 'helpers', 'common', 'shared', 'tools', 'pkg'], 'utility'],
  [['config', 'constants', 'env', 'settings', 'management', 'commands', 'resources'], 'config'],
  [['__tests__', 'test', 'tests', 'spec', 'specs'], 'test'],
  [['types', 'interfaces', 'schemas', 'schema', 'contracts', 'dtos', 'dto', 'request', 'response'], 'types'],
  [['hooks'], 'hooks'],
  [['store', 'state', 'reducers', 'actions', 'slices'], 'state'],
  [['assets', 'static', 'public', 'styles'], 'assets'],
  [['cmd', 'bin'], 'entry'],
  [['docs', 'documentation', 'wiki'], 'documentation'],
  [['deploy', 'deployment', 'infra', 'infrastructure', 'docker', 'k8s', 'kubernetes', 'helm', 'charts', 'terraform', 'tf'], 'infrastructure'],
  [['.github', '.gitlab', '.circleci'], 'ci-cd'],
];
function matchDir(name) {
  const leaf = name.split('/').pop().toLowerCase();
  for (const [names, label] of DIR_PATTERNS) if (names.includes(leaf)) return label;
  return null;
}
const patternMatches = {};
Object.keys(directoryGroups).forEach(g => { patternMatches[g] = matchDir(g) || 'unknown'; });

// file-level patterns
const filePatterns = {};
function matchFile(n) {
  const fp = norm(n.filePath), base = fp.split('/').pop();
  if (/\.(test|spec)\.[jt]sx?$/.test(base) || /^test_.*\.py$/.test(base) || /_test\.go$/.test(base) ||
      /Test\.java$/.test(base) || /Tests?\.java$/.test(base) || /_spec\.rb$/.test(base)) return 'test';
  if (/\.d\.ts$/.test(base)) return 'types';
  if (/^(Dockerfile|docker-compose)/i.test(base)) return 'infrastructure';
  if (/\.(tf|tfvars)$/.test(base)) return 'infrastructure';
  if (/^Makefile$/.test(base) || /^nixpacks\.toml$/.test(base) || /^Procfile$/.test(base)) return 'infrastructure';
  if (fp.includes('.github/workflows/') || /^(\.gitlab-ci\.yml|Jenkinsfile)$/.test(base)) return 'ci-cd';
  if (/\.sql$/.test(base)) return 'data';
  if (/\.(graphql|gql|proto)$/.test(base)) return 'types';
  if (/\.(md|rst)$/i.test(base)) return 'documentation';
  if (/^(Cargo\.toml|go\.mod|Gemfile|pom\.xml|build\.gradle|settings\.gradle|composer\.json|package\.json|tsconfig.*\.json)$/.test(base)) return 'config';
  if (/^(BackendApplication|MuscleupApplication|Application|Program|main)\.(java|cs|go|rs)$/.test(base)) return 'entry';
  if (/^(main|index)\.(tsx?|jsx?)$/.test(base)) return 'entry';
  if (/^(server)\.ts$/.test(base)) return 'entry';
  return null;
}
fileNodes.forEach(n => { const m = matchFile(n); if (m) filePatterns[n.id] = m; });

// ---------- H. Deployment topology ----------
const infraFiles = [];
let hasDockerfile = false, hasCompose = false, hasK8s = false, hasTerraform = false, hasCI = false;
fileNodes.forEach(n => {
  const fp = norm(n.filePath), base = fp.split('/').pop();
  if (/^Dockerfile/i.test(base)) { hasDockerfile = true; infraFiles.push(fp); }
  else if (/^docker-compose/i.test(base)) { hasCompose = true; infraFiles.push(fp); }
  else if (/\.(tf|tfvars)$/.test(base)) { hasTerraform = true; infraFiles.push(fp); }
  else if (/(k8s|kubernetes|helm|charts)\//.test(fp)) { hasK8s = true; infraFiles.push(fp); }
  else if (fp.includes('.github/workflows/') || /^(\.gitlab-ci\.yml|Jenkinsfile)$/.test(base)) { hasCI = true; infraFiles.push(fp); }
  else if (/^(nixpacks\.toml|Procfile|Makefile|vercel\.json|railway\.json|render\.yaml|fly\.toml|ecosystem\.config\.[jc]s)$/i.test(base)) { infraFiles.push(fp); }
});

// ---------- I. Data pipeline ----------
const dataPipeline = { schemaFiles: [], migrationFiles: [], dataModelFiles: [], apiHandlerFiles: [], tableNodes: [] };
fileNodes.forEach(n => {
  const fp = norm(n.filePath), base = fp.split('/').pop();
  const tags = (n.tags || []).map(t => String(t).toLowerCase());
  if (n.type === 'table') { dataPipeline.tableNodes.push(n.id); return; }
  if (/\.(graphql|gql|proto|prisma)$/.test(base)) dataPipeline.schemaFiles.push(fp);
  if (/\.sql$/.test(base) || /migration/i.test(base)) dataPipeline.migrationFiles.push(fp);
  if (/\/(entity|entities|models?|repository|repositories)\//.test(fp) || tags.includes('entity') || tags.includes('data-model')) dataPipeline.dataModelFiles.push(fp);
  if (/\/(controller|controllers|routes|api)\//.test(fp) || tags.includes('api-handler') || tags.includes('controller')) dataPipeline.apiHandlerFiles.push(fp);
});
['schemaFiles', 'migrationFiles', 'dataModelFiles', 'apiHandlerFiles'].forEach(k => {
  dataPipeline[k] = [...new Set(dataPipeline[k])];
});

// ---------- J. Documentation coverage ----------
const docGroups = new Set();
fileNodes.forEach(n => {
  if (n.type === 'document' || /\.(md|rst)$/i.test(norm(n.filePath))) docGroups.add(groupByNode.get(n.id));
});
const allGroups = Object.keys(directoryGroups);
const undocumentedGroups = allGroups.filter(g => !docGroups.has(g));
const docCoverage = {
  groupsWithDocs: docGroups.size,
  totalGroups: allGroups.length,
  coverageRatio: +(docGroups.size / allGroups.length).toFixed(2),
  undocumentedGroups,
};

// ---------- K. Dependency direction ----------
const pairSeen = new Set();
const dependencyDirection = [];
interGroupImports.forEach(({ from, to, count }) => {
  const key = [from, to].sort().join('|');
  if (pairSeen.has(key)) return;
  pairSeen.add(key);
  const rev = igMap.get(to + '|' + from) || 0;
  if (count > rev) dependencyDirection.push({ dependent: from, dependsOn: to, forward: count, reverse: rev });
  else if (rev > count) dependencyDirection.push({ dependent: to, dependsOn: from, forward: rev, reverse: count });
  else dependencyDirection.push({ dependent: from, dependsOn: to, forward: count, reverse: rev, bidirectional: true });
});

// ---------- stats ----------
const filesPerGroup = {}, nodeTypeCounts = {};
Object.entries(directoryGroups).forEach(([g, ids]) => { filesPerGroup[g] = ids.length; });
Object.entries(nodeTypeGroups).forEach(([t, ids]) => { nodeTypeCounts[t] = ids.length; });

const topFanIn = Object.entries(fileFanIn).sort((a, b) => b[1] - a[1]).slice(0, 30);
const topFanOut = Object.entries(fileFanOut).sort((a, b) => b[1] - a[1]).slice(0, 30);
const orphans = fileNodes.filter(n => !fileFanIn[n.id] && !fileFanOut[n.id]).map(n => n.id);

const result = {
  scriptCompleted: true,
  commonPrefix: prefix,
  directoryGroups,
  nodeTypeGroups,
  crossCategoryEdges,
  interGroupImports,
  intraGroupDensity,
  patternMatches,
  filePatterns,
  deploymentTopology: { hasDockerfile, hasCompose, hasK8s, hasTerraform, hasCI, infraFiles: [...new Set(infraFiles)] },
  dataPipeline,
  docCoverage,
  dependencyDirection,
  fileStats: { totalFileNodes: fileNodes.length, filesPerGroup, nodeTypeCounts },
  fileFanIn,
  fileFanOut,
  topFanIn,
  topFanOut,
  orphanNodes: orphans,
};

fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
console.log('OK groups=' + allGroups.length + ' files=' + fileNodes.length + ' orphans=' + orphans.length);
process.exit(0);
