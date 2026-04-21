const DEFAULT_BASE_URL = 'https://plugin.human-like.me';
const ALLOWED_ENV_KEYS = Object.freeze({
  API_KEY: 'HUMAN_LIKE_MEM_API_KEY',
  BASE_URL: 'HUMAN_LIKE_MEM_BASE_URL',
  USER_ID: 'HUMAN_LIKE_MEM_USER_ID',
  AGENT_ID: 'HUMAN_LIKE_MEM_AGENT_ID',
  LIMIT_NUMBER: 'HUMAN_LIKE_MEM_LIMIT_NUMBER',
  MIN_SCORE: 'HUMAN_LIKE_MEM_MIN_SCORE',
  TIMEOUT_MS: 'HUMAN_LIKE_MEM_TIMEOUT_MS',
  SCENARIO: 'HUMAN_LIKE_MEM_SCENARIO',
  RECALL_ENABLED: 'HUMAN_LIKE_MEM_RECALL_ENABLED',
  ADD_ENABLED: 'HUMAN_LIKE_MEM_ADD_ENABLED',
  AUTO_SAVE_ENABLED: 'HUMAN_LIKE_MEM_AUTO_SAVE_ENABLED',
  SAVE_TRIGGER_TURNS: 'HUMAN_LIKE_MEM_SAVE_TRIGGER_TURNS',
  SAVE_MAX_MESSAGES: 'HUMAN_LIKE_MEM_SAVE_MAX_MESSAGES',
  USE_V2_PROTOCOL: 'HUMAN_LIKE_MEM_USE_V2_PROTOCOL',
  CAPTURE_TOOL_CALLS: 'HUMAN_LIKE_MEM_CAPTURE_TOOL_CALLS',
});
const ALLOWED_ENV_KEY_SET = new Set(Object.values(ALLOWED_ENV_KEYS));
const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function parseBoolean(value, defaultValue) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  return defaultValue;
}

function parseInteger(value, defaultValue) {
  const parsed = parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function parseFloatValue(value, defaultValue) {
  const parsed = parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function readSkillEnv(name) {
  if (!ALLOWED_ENV_KEY_SET.has(name)) {
    throw new Error(`Unsupported environment variable access: ${name}`);
  }
  return process.env[name];
}

function normalizeBaseUrl(rawValue) {
  const candidate = (rawValue || DEFAULT_BASE_URL).trim();
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(`Invalid HUMAN_LIKE_MEM_BASE_URL: ${candidate}`);
  }

  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new Error('HUMAN_LIKE_MEM_BASE_URL must use http or https');
  }

  if (parsed.protocol === 'http:' && !LOCALHOST_HOSTS.has(parsed.hostname)) {
    throw new Error('HUMAN_LIKE_MEM_BASE_URL must use https unless targeting localhost');
  }

  const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '');
  return `${parsed.origin}${path}`;
}

function getCliValue(cliOptions, key) {
  if (!cliOptions || typeof cliOptions !== 'object') return undefined;
  return cliOptions[key];
}

function getConfigValue(cliOptions, cliKey, envKey) {
  const cliValue = getCliValue(cliOptions, cliKey);
  if (cliValue !== undefined && cliValue !== null && cliValue !== '') {
    return cliValue;
  }
  return readSkillEnv(envKey);
}

export async function buildConfig(cliOptions = {}) {
  const rawLimit = getConfigValue(cliOptions, 'memory-limit', ALLOWED_ENV_KEYS.LIMIT_NUMBER);
  const rawMinScore = getConfigValue(cliOptions, 'min-score', ALLOWED_ENV_KEYS.MIN_SCORE);
  const rawTimeoutMs = getConfigValue(cliOptions, 'timeout-ms', ALLOWED_ENV_KEYS.TIMEOUT_MS);
  const rawSaveTriggerTurns = getConfigValue(cliOptions, 'save-trigger-turns', ALLOWED_ENV_KEYS.SAVE_TRIGGER_TURNS);
  const rawSaveMaxMessages = getConfigValue(cliOptions, 'save-max-messages', ALLOWED_ENV_KEYS.SAVE_MAX_MESSAGES);

  return {
    baseUrl: normalizeBaseUrl(getConfigValue(cliOptions, 'base-url', ALLOWED_ENV_KEYS.BASE_URL)),
    apiKey: readSkillEnv(ALLOWED_ENV_KEYS.API_KEY),
    userId: getConfigValue(cliOptions, 'user-id', ALLOWED_ENV_KEYS.USER_ID) || 'default-user',
    agentId: getConfigValue(cliOptions, 'agent-id', ALLOWED_ENV_KEYS.AGENT_ID) || 'main',
    memoryLimitNumber: Math.max(1, parseInteger(rawLimit, 6)),
    minScore: parseFloatValue(rawMinScore, 0.1),
    timeoutMs: Math.max(1000, parseInteger(rawTimeoutMs, 30000)),
    scenario: getConfigValue(cliOptions, 'scenario', ALLOWED_ENV_KEYS.SCENARIO) || 'human-like-memory-skill',
    recallEnabled: parseBoolean(getConfigValue(cliOptions, 'recall-enabled', ALLOWED_ENV_KEYS.RECALL_ENABLED), true),
    addEnabled: parseBoolean(getConfigValue(cliOptions, 'add-enabled', ALLOWED_ENV_KEYS.ADD_ENABLED), true),
    autoSaveEnabled: parseBoolean(getConfigValue(cliOptions, 'auto-save-enabled', ALLOWED_ENV_KEYS.AUTO_SAVE_ENABLED), true),
    saveTriggerTurns: Math.max(1, parseInteger(rawSaveTriggerTurns, 5)),
    saveMaxMessages: Math.max(2, parseInteger(rawSaveMaxMessages, 20)),
    useV2Protocol: parseBoolean(getConfigValue(cliOptions, 'use-v2-protocol', ALLOWED_ENV_KEYS.USE_V2_PROTOCOL), true),
    captureToolCalls: parseBoolean(getConfigValue(cliOptions, 'capture-tool-calls', ALLOWED_ENV_KEYS.CAPTURE_TOOL_CALLS), true),
  };
}

export function buildMissingApiKeyError() {
  return {
    success: false,
    error: 'API key not configured. HUMAN_LIKE_MEM_API_KEY is required.',
    nextSteps: [
      'OpenClaw: run `openclaw config set skills.entries.human-like-memory.apiKey "mp_xxx"`',
      'Hermes: run `hermes config set HUMAN_LIKE_MEM_API_KEY "mp_xxx"` or add it to `~/.hermes/.env`',
      'Other runtimes: inject `HUMAN_LIKE_MEM_API_KEY` via your shell or secret manager',
      'Then verify with `node scripts/memory.mjs config`',
    ],
    helpUrl: 'https://plugin.human-like.me',
  };
}
