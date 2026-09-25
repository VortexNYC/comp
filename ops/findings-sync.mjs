#!/usr/bin/env node
/**
 * Findings→Pile sync (COMP-5). Polls each CompAI org for open findings and
 * files any not-yet-tracked ones as issues on the owning Pile board.
 * State lives in ops/findings-sync.json (finding id → pile identifier);
 * entries marked "preexisting-*" were ticketed manually during the audit.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const COMP_API = (process.env.COMP_API_URL ?? 'https://api.comp.vortex.nyc').replace(/\/$/, '');
const PILE_API = (process.env.PILE_BASE_URL ?? 'https://pile.nyc').replace(/\/$/, '');
const PILE_KEY = process.env.PILE_API_KEY;
const PILE_WORKSPACE = 'org_vortex_main';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATE_PATH = join(ROOT, 'ops', 'findings-sync.json');

// CompAI org → owning Pile team
const ORGS = [
  { key: 'vortex', compKey: process.env.COMP_KEY_VORTEX, teamId: 'dc12bdf0-d816-4b27-90fc-984223a2a99a', teamKey: 'VOR' },
  { key: 'veil',   compKey: process.env.COMP_KEY_VEIL,   teamId: 'fea8a019-55a1-4b7b-abab-f3c53c59d670', teamKey: 'VEIL' },
  { key: 'seal',   compKey: process.env.COMP_KEY_SEAL,   teamId: '8425cd73-0a46-44bd-9ebb-89fa2d355856', teamKey: 'SEA' },
  { key: 'pile',   compKey: process.env.COMP_KEY_PILE,   teamId: 'cb1f8d42-f007-4418-ae92-18842f1cfbf9', teamKey: 'PILE' },
];

const PRIORITY = { critical: 'urgent', high: 'high', medium: 'medium', low: 'low' };

async function compGet(key, path) {
  const res = await fetch(`${COMP_API}${path}`, {
    headers: { 'x-api-key': key, accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`comp ${path} -> HTTP ${res.status}`);
  return res.json();
}

async function pileCreate({ title, description, teamId, priority, externalRef }) {
  const res = await fetch(`${PILE_API}/workspaces/${PILE_WORKSPACE}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PILE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, description, teamId, status: 'backlog', priority, externalRef }),
  });
  if (!res.ok) throw new Error(`pile create -> HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

function findingTitle(f) {
  const first = (f.content ?? '').split('\n')[0].replace(/^\[.*?\]\s*/, '').trim();
  return (first || f.id).slice(0, 120);
}

const state = JSON.parse(readFileSync(STATE_PATH, 'utf8'));
let created = 0;

for (const org of ORGS) {
  if (!org.compKey) { console.warn(`[${org.key}] no COMP_KEY — skipping`); continue; }
  const res = await compGet(org.compKey, '/v1/findings');
  const findings = Array.isArray(res) ? res : (res.data ?? []);
  for (const f of findings) {
    if (state[f.id] || f.status === 'closed' || f.status === 'resolved') continue;
    const issue = await pileCreate({
      title: `[${org.key}] ${findingTitle(f)}`,
      description:
        `CompAI finding \`${f.id}\` on the **${org.key}** org (severity: ${f.severity ?? 'n/a'}, type: ${f.type ?? 'n/a'}).\n\n` +
        `${(f.content ?? '').slice(0, 3000)}\n\n` +
        `_Auto-filed by findings-sync (COMP-5)._`,
      teamId: org.teamId,
      priority: PRIORITY[f.severity] ?? 'medium',
      externalRef: `compai:${f.id}`,
    });
    const ident = issue?.identifier ?? issue?.issue?.identifier ?? issue?.id ?? 'unknown';
    state[f.id] = ident;
    created++;
    console.log(`[${org.key}] ${f.id} -> ${ident}`);
  }
}

writeFileSync(STATE_PATH, JSON.stringify(state, null, 1) + '\n');
console.log(`sync complete: ${created} new issue(s) filed`);
