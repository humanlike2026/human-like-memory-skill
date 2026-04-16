#!/usr/bin/env node

import { chmod, cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const distRoot = path.join(repoRoot, 'dist');
const installRoot = path.join(repoRoot, 'install');

const adapters = [
  {
    id: 'openclaw',
    packageName: 'human-like-memory',
    adapterFiles: ['SKILL.md', 'skill.json'],
    includeHermesHelper: false,
    publishGitHubInstall: false,
  },
  {
    id: 'hermes',
    packageName: 'human-like-memory',
    adapterFiles: ['SKILL.md'],
    includeHermesHelper: true,
    publishGitHubInstall: false,
  },
  {
    id: 'codex',
    packageName: 'human-like-memory',
    adapterFiles: ['SKILL.md'],
    includeHermesHelper: false,
    publishGitHubInstall: true,
  },
  {
    id: 'claude-code',
    packageName: 'human-like-memory',
    adapterFiles: ['SKILL.md'],
    includeHermesHelper: false,
    publishGitHubInstall: true,
  },
];

async function copyCoreScripts(outDir) {
  const outScriptsDir = path.join(outDir, 'scripts');
  await mkdir(outScriptsDir, { recursive: true });
  for (const filename of ['client.mjs', 'config.mjs', 'memory.mjs']) {
    await cp(
      path.join(repoRoot, 'core', 'scripts', filename),
      path.join(outScriptsDir, filename)
    );
  }
}

async function copySharedDocs(outDir, adapterId) {
  const docsDir = path.join(outDir, 'docs');
  await mkdir(docsDir, { recursive: true });
  await cp(path.join(repoRoot, 'core', 'docs', 'shared-config.md'), path.join(docsDir, 'shared-config.md'));
  await cp(path.join(repoRoot, 'core', 'docs', 'security-model.md'), path.join(docsDir, 'security-model.md'));
  await cp(path.join(repoRoot, 'docs', 'platforms', `${adapterId}.md`), path.join(outDir, 'README.md'));
}

async function copyAdapterFiles(adapter, outDir) {
  for (const filename of adapter.adapterFiles) {
    await cp(
      path.join(repoRoot, 'adapters', adapter.id, filename),
      path.join(outDir, filename)
    );
  }
}

async function maybeCopyHermesHelper(adapter, outDir) {
  if (!adapter.includeHermesHelper) return;
  const helperSource = path.join(repoRoot, 'integrations', 'hermes-provider', 'setup-hermes-provider.sh');
  const helperTarget = path.join(outDir, 'scripts', 'setup-hermes-provider.sh');
  await cp(helperSource, helperTarget);
  await chmod(helperTarget, 0o755);
}

async function buildAdapter(adapter, outputRoot) {
  const outDir = path.join(outputRoot, adapter.id, adapter.packageName);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await cp(path.join(repoRoot, 'LICENSE'), path.join(outDir, 'LICENSE'));
  await copyCoreScripts(outDir);
  await copySharedDocs(outDir, adapter.id);
  await copyAdapterFiles(adapter, outDir);
  await maybeCopyHermesHelper(adapter, outDir);
  return outDir;
}

async function main() {
  await rm(distRoot, { recursive: true, force: true });
  await mkdir(installRoot, { recursive: true });

  const builtDist = [];
  for (const adapter of adapters) {
    builtDist.push(await buildAdapter(adapter, distRoot));
  }

  const builtInstall = [];
  for (const adapter of adapters.filter((item) => item.publishGitHubInstall)) {
    builtInstall.push(await buildAdapter(adapter, installRoot));
  }

  console.log('Built distributions:');
  for (const dir of builtDist) {
    console.log(`- ${path.relative(repoRoot, dir)}`);
  }

  if (builtInstall.length > 0) {
    console.log('');
    console.log('Refreshed GitHub install targets:');
    for (const dir of builtInstall) {
      console.log(`- ${path.relative(repoRoot, dir)}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
