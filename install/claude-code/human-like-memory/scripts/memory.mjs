#!/usr/bin/env node
/**
 * Human-Like Memory CLI
 *
 * Usage:
 *   node memory.mjs recall "query" [flags]
 *   node memory.mjs save "user message" "assistant response" [flags]
 *   node memory.mjs save-batch [flags]              # reads JSON from stdin
 *   node memory.mjs search "query" [flags]
 *   node memory.mjs config [flags]
 *   node memory.mjs help
 */

import { createInterface } from 'readline';
import { buildConfig, buildMissingApiKeyError } from './config.mjs';
import { httpRequest } from './client.mjs';

const SKILL_VERSION = '2.1.0';
const USER_QUERY_MARKER = '--- User Query ---';
const RELEVANT_MEMORIES_BLOCK_RE = /<relevant-memories>[\s\S]*?<\/relevant-memories>/gi;
const CONVERSATION_METADATA_BLOCK_RE =
  /(?:^|\n)\s*(?:Conversation info|Conversation metadata|会话信息|对话信息)\s*(?:\([^)]+\))?\s*:\s*```[\s\S]*?```/gi;
const SENDER_METADATA_BLOCK_RE =
  /(?:^|\n)\s*Sender\s*\([^)]*\)\s*:\s*```[\s\S]*?```/gi;
const FENCED_JSON_BLOCK_RE = /```json\s*([\s\S]*?)```/gi;
const METADATA_JSON_KEY_RE =
  /"(session|sessionid|sessionkey|conversationid|channel|sender|userid|agentid|timestamp|timezone)"\s*:/gi;
const FEISHU_TAIL_RE =
  /\[Feishu[^\]]*\]\s*[^:\n]+:\s*([\s\S]*?)(?:\n\[message_id:[^\]]+\]\s*)?$/i;
const DISCORD_TAIL_RE =
  /\[from:\s*[^\(\]\n]+?\s*\(\d{6,}\)\]\s*([\s\S]*?)$/i;
const MESSAGE_ID_WITH_SPEAKER_RE =
  /^\[message_id:\s*[^\]]+\]\s*[^:\n：]{1,80}[：:]\s*([\s\S]+)$/i;
const MESSAGE_ID_PREFIX_RE = /^\[message_id:\s*[^\]]+\]\s*/i;

function truncate(text, maxLen) {
  if (!text || text.length <= maxLen) return text || '';
  return text.substring(0, maxLen - 3) + '...';
}

function formatLogValue(value, maxLen = 48) {
  if (value === undefined || value === null || value === '') return '-';
  if (Array.isArray(value)) {
    if (value.length === 0) return '-';
    const items = value.slice(0, 3).map((item) => truncate(String(item), 24));
    return items.join(',') + (value.length > 3 ? ',...' : '');
  }
  return truncate(String(value), maxLen);
}

function maskSecretForLog(value, prefix = 10, suffix = 6) {
  const text = String(value || '').trim();
  if (!text) return '-';
  if (text.length <= prefix + suffix) return text;
  return `${text.slice(0, prefix)}...${text.slice(-suffix)}`;
}

function buildRequestId(prefix = 'human-like-memory-skill') {
  return `${prefix}-${Date.now()}`;
}

function parseCli(argv) {
  const args = [...argv];
  const options = {};
  const positional = [];

  while (args.length > 0) {
    const current = args.shift();

    if (!current.startsWith('--')) {
      positional.push(current);
      continue;
    }

    const withoutPrefix = current.slice(2);
    const [rawKey, inlineValue] = withoutPrefix.split('=', 2);
    const key = rawKey.trim();

    if (key === 'help') {
      options.help = true;
      continue;
    }

    const next = inlineValue ?? args.shift();
    options[key] = next;
  }

  return { positional, options };
}

function memoryPreviewItem(memory, rank) {
  if (!memory || typeof memory !== 'object') {
    return `#${rank} id=- text="-"`;
  }
  const parts = [
    `#${rank}`,
    `id=${formatLogValue(memory.id, 8)}`,
  ];
  if (typeof memory.score === 'number' && Number.isFinite(memory.score)) {
    parts.push(`s=${memory.score.toFixed(6)}`);
  }
  parts.push(`text="${truncate(memory.description || memory.event || memory.content || '', 80)}"`);
  return parts.join(' ');
}

function memoryPreviewSummary(memories, limit = 3) {
  if (!Array.isArray(memories) || memories.length === 0) return '-';
  return memories.slice(0, limit).map((memory, index) => memoryPreviewItem(memory, index + 1)).join(' | ');
}

function logSkillStage(stage, fields = {}) {
  const content = Object.entries(fields)
    .map(([key, value]) => `${key}=${formatLogValue(value, key === 'top' ? 240 : 96)}`)
    .join(' ');
  console.error(`[HumanLike Memory Skill][${stage}] ${content}`.trim());
}

function collapseQueryWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function stripPrependedPromptForQuery(value) {
  const text = String(value || '');
  if (!text) return '';
  const markerIndex = text.indexOf(USER_QUERY_MARKER);
  if (markerIndex === -1) return text;
  return text.substring(markerIndex + USER_QUERY_MARKER.length).trim();
}

function looksLikeMetadataJsonBlock(content) {
  const matchedKeys = new Set();
  const matches = String(content || '').matchAll(METADATA_JSON_KEY_RE);
  for (const match of matches) {
    const key = String(match[1] || '').toLowerCase();
    if (key) matchedKeys.add(key);
  }
  return matchedKeys.size >= 3;
}

function stripInjectedContextBlocksForQuery(value) {
  if (!value) return '';
  return String(value)
    .replace(RELEVANT_MEMORIES_BLOCK_RE, '\n')
    .replace(CONVERSATION_METADATA_BLOCK_RE, '\n')
    .replace(SENDER_METADATA_BLOCK_RE, '\n')
    .replace(FENCED_JSON_BLOCK_RE, (full, inner) =>
      looksLikeMetadataJsonBlock(String(inner || '')) ? '\n' : full
    )
    .replace(/\u0000/g, '');
}

function isMetadataOnlyQuery(value) {
  const text = String(value || '').trim();
  if (!text) return true;
  if (/^\[message_id:\s*[^\]]+\]$/i.test(text)) return true;
  if (/^\[\[reply_to[^\]]*\]\]$/i.test(text)) return true;
  return false;
}

function extractLatestSystemTranscriptMessage(value) {
  const text = String(value || '');
  if (!text) return '';

  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let latest = '';
  for (const rawLine of lines) {
    const line = rawLine.trim();
    const match = line.match(/^System:\s*\[[^\]]+\]\s*.+?:\s*(.+)$/i);
    if (match && match[1]) {
      const candidate = match[1].trim();
      if (candidate) latest = candidate;
    }
  }
  return latest;
}

function normalizeSearchQuery(value) {
  const text = stripInjectedContextBlocksForQuery(stripPrependedPromptForQuery(value));
  if (!text) return '';

  const normalized = String(text).replace(/\r\n/g, '\n').trim();
  if (!normalized) return '';

  const latestSystemMessage = extractLatestSystemTranscriptMessage(normalized);
  if (latestSystemMessage && !isMetadataOnlyQuery(latestSystemMessage)) {
    return collapseQueryWhitespace(latestSystemMessage);
  }

  const feishuTail = normalized.match(FEISHU_TAIL_RE);
  if (feishuTail && feishuTail[1]) {
    const candidate = feishuTail[1].trim();
    if (!isMetadataOnlyQuery(candidate)) return collapseQueryWhitespace(candidate);
  }

  const discordTail = normalized.match(DISCORD_TAIL_RE);
  if (discordTail && discordTail[1]) {
    const candidate = discordTail[1].trim();
    if (!isMetadataOnlyQuery(candidate)) return collapseQueryWhitespace(candidate);
  }

  const messageIdWithSpeaker = normalized.match(MESSAGE_ID_WITH_SPEAKER_RE);
  if (messageIdWithSpeaker && messageIdWithSpeaker[1]) {
    const candidate = messageIdWithSpeaker[1].trim();
    if (!isMetadataOnlyQuery(candidate)) return collapseQueryWhitespace(candidate);
  }

  const withoutMessageId = normalized.replace(MESSAGE_ID_PREFIX_RE, '').trim();
  if (withoutMessageId && !isMetadataOnlyQuery(withoutMessageId)) {
    return collapseQueryWhitespace(withoutMessageId);
  }

  return isMetadataOnlyQuery(normalized) ? '' : collapseQueryWhitespace(normalized);
}

function extractText(content) {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((block) => block && typeof block === 'object' && block.type === 'text')
      .map((block) => String(block.text || ''))
      .join(' ')
      .trim();
  }
  return '';
}

function stripPrependedPrompt(value) {
  const text = extractText(value);
  if (!text) return '';
  const markerIndex = text.indexOf(USER_QUERY_MARKER);
  if (markerIndex === -1) return text;
  return text.substring(markerIndex + USER_QUERY_MARKER.length).trim();
}

function isToolCallBlock(block) {
  if (!block || typeof block !== 'object') return false;
  const type = String(block.type || '').trim().toLowerCase();
  return type === 'toolcall' || type === 'tool_call';
}

function normalizeToolCallBlock(block) {
  if (!isToolCallBlock(block)) return null;

  const name = block.function?.name || block.toolName || block.name || 'unknown';
  const args = block.function?.arguments ?? block.arguments ?? block.args ?? block.input ?? {};
  const callId = block.id || block.callId || block.toolCallId || block.tool_call_id || null;

  return {
    id: callId,
    name,
    arguments: args,
    function: {
      name,
      arguments: args,
    },
  };
}

function extractToolCallsFromContent(content) {
  if (!Array.isArray(content)) return [];
  return content
    .map((block) => normalizeToolCallBlock(block))
    .filter(Boolean);
}

function getMessageToolCalls(message) {
  if (!message || typeof message !== 'object') return [];
  if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
    return message.tool_calls;
  }
  return extractToolCallsFromContent(message.content);
}

function getToolResultCallId(message) {
  if (!message || typeof message !== 'object') return null;
  return message.tool_call_id || message.toolCallId || message.call_id || message.callId || null;
}

function getToolResultName(message) {
  if (!message || typeof message !== 'object') return undefined;
  return message.name || message.toolName || message.tool_name || undefined;
}

function normalizeInputRole(role) {
  if (role === 'toolResult') return 'tool';
  return String(role || '').trim();
}

function normalizeMessageContent(content, options = {}) {
  const source = options.rawContent !== undefined ? options.rawContent : content;
  const extracted = options.stripPrepended ? stripPrependedPrompt(source) : extractText(source);
  return String(extracted || '').trim();
}

function normalizeInputMessage(message) {
  if (!message || typeof message !== 'object') {
    return { error: 'Each message must be an object with at least a role field' };
  }

  const role = normalizeInputRole(message.role);
  if (!['user', 'assistant', 'tool', 'system'].includes(role)) {
    return { error: `Role must be one of "user", "assistant", "tool", "toolResult", or "system" (received "${message.role}")` };
  }

  const rawContent = message.rawContent !== undefined ? message.rawContent : message.content;

  if (role === 'system') {
    return { message: null };
  }

  if (role === 'user') {
    const content = normalizeMessageContent(message.content, {
      rawContent,
      stripPrepended: true,
    });
    return { message: content ? { role, content } : null };
  }

  if (role === 'assistant') {
    const content = normalizeMessageContent(message.content, { rawContent });
    const toolCalls = getMessageToolCalls(message);
    if (!content && toolCalls.length === 0) {
      return { message: null };
    }
    return {
      message: {
        role,
        content: content || '',
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      },
    };
  }

  const content = normalizeMessageContent(message.content, { rawContent });
  const toolCallId = getToolResultCallId(message);
  const name = getToolResultName(message);
  if (!content && !toolCallId && !name) {
    return { message: null };
  }
  return {
    message: {
      role: 'tool',
      content: content || '',
      tool_call_id: toolCallId || undefined,
      name,
    },
  };
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { error: 'Messages must be a non-empty array' };
  }

  const normalized = [];
  for (const message of messages) {
    const result = normalizeInputMessage(message);
    if (result.error) {
      return { error: result.error, invalid: message };
    }
    if (result.message) {
      normalized.push(result.message);
    }
  }

  if (normalized.length === 0) {
    return { error: 'No non-empty user, assistant, or tool messages to save' };
  }

  return { messages: normalized };
}

function getLatestUserMessageText(messages) {
  if (!Array.isArray(messages)) return '';
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === 'user') return messages[i].content || '';
  }
  return '';
}

function buildWorkflowMetadata(cfg, sessionId, agentId) {
  return {
    user_ids: [cfg.userId],
    agent_ids: [agentId],
    session_id: sessionId,
    scenario: cfg.scenario || 'human-like-memory-skill',
  };
}

function stripToolMessagesForV1(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((message) => message && message.role !== 'tool' && message.role !== 'system')
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

function extractToolCalls(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return [];

  const calls = [];
  for (const message of messages) {
    if (message.role === 'assistant') {
      const toolCalls = getMessageToolCalls(message);
      for (const toolCall of toolCalls) {
        calls.push({
          tool_name: toolCall.function?.name || toolCall.name || 'unknown',
          arguments: toolCall.function?.arguments || toolCall.arguments || {},
          call_id: toolCall.id || null,
          result: null,
          success: null,
          duration_ms: null,
        });
      }
    }

    if (message.role !== 'tool') continue;

    const toolCallId = getToolResultCallId(message);
    const toolName = getToolResultName(message);
    const match = calls.find((call) =>
      (toolCallId && call.call_id === toolCallId) ||
      (!toolCallId && toolName && call.tool_name === toolName && call.result == null)
    );
    if (match) {
      const resultText = extractText(message.content);
      match.result = truncate(resultText, 2000);
      match.success = !isErrorResult(resultText);
    }
  }

  return calls;
}

function isErrorResult(text) {
  if (!text) return false;
  const lower = String(text).toLowerCase();
  return lower.includes('error') ||
    lower.includes('exception') ||
    lower.includes('failed') ||
    lower.includes('traceback') ||
    lower.includes('enoent') ||
    lower.includes('permission denied');
}

function buildV2ConversationMessages(messages, captureToolCalls) {
  return messages
    .filter((message) => message && message.role !== 'system')
    .filter((message) => captureToolCalls || message.role !== 'tool')
    .map((message) => {
      if (message.role === 'tool') {
        return {
          role: 'tool',
          content: message.content || '',
          tool_call_id: message.tool_call_id || undefined,
          name: message.name,
        };
      }

      return {
        role: message.role,
        content: message.content || '',
        tool_calls: captureToolCalls && Array.isArray(message.tool_calls) && message.tool_calls.length > 0
          ? message.tool_calls
          : undefined,
      };
    })
    .filter((message) => {
      if (!message) return false;
      if (message.role === 'tool') {
        return !!(message.content || message.tool_call_id || message.name);
      }
      return !!(message.content || (Array.isArray(message.tool_calls) && message.tool_calls.length > 0));
    });
}

function collectContextBlocks(messages, cfg) {
  const blocks = [];
  const conversationMessages = buildV2ConversationMessages(messages, cfg.captureToolCalls !== false);
  if (conversationMessages.length > 0) {
    blocks.push({
      type: 'conversation',
      data: { messages: conversationMessages },
    });
  }

  if (cfg.captureToolCalls !== false) {
    const toolCalls = extractToolCalls(messages);
    if (toolCalls.length > 0) {
      blocks.push({
        type: 'tool_calls',
        data: { calls: toolCalls },
      });
    }
  }

  return blocks;
}

async function addMemoryV1(messages, cfg, sessionId, requestId) {
  const agentId = cfg.agentId || 'main';
  const url = `${cfg.baseUrl}/api/plugin/v1/add/message`;
  const payload = {
    user_id: cfg.userId,
    conversation_id: sessionId,
    messages: stripToolMessagesForV1(messages),
    agent_id: agentId,
    scenario: cfg.scenario || 'human-like-memory-skill',
    async_mode: true,
    custom_workflows: {
      stream_params: {
        metadata: JSON.stringify(buildWorkflowMetadata(cfg, sessionId, agentId)),
      },
    },
  };

  const result = await httpRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cfg.apiKey,
      'x-request-id': requestId,
      'x-plugin-version': SKILL_VERSION,
      'x-client-type': 'skill',
    },
    body: JSON.stringify(payload),
  }, cfg.timeoutMs);

  return { result, protocol: 'v1', url, payload };
}

async function addContextV2(messages, cfg, sessionId, requestId) {
  const agentId = cfg.agentId || 'main';
  const url = `${cfg.baseUrl}/api/plugin/v2/add/context`;
  const contextBlocks = collectContextBlocks(messages, cfg);
  if (contextBlocks.length === 0) {
    throw new Error('No context blocks to save');
  }

  const payload = {
    user_id: cfg.userId,
    conversation_id: sessionId,
    agent_id: agentId,
    scenario: cfg.scenario || 'human-like-memory-skill',
    async_mode: true,
    protocol_version: '2.0',
    context_blocks: contextBlocks,
    custom_workflows: {
      stream_params: {
        metadata: JSON.stringify(buildWorkflowMetadata(cfg, sessionId, agentId)),
      },
    },
  };

  const result = await httpRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cfg.apiKey,
      'x-request-id': requestId,
      'x-plugin-version': SKILL_VERSION,
      'x-client-type': 'skill',
    },
    body: JSON.stringify(payload),
  }, cfg.timeoutMs);

  return { result, protocol: 'v2', url, payload };
}

async function saveNormalizedMessages(messages, cfg) {
  const sessionId = `session-${Date.now()}`;
  const agentId = cfg.agentId || 'main';
  const requestId = buildRequestId();
  const requestStart = Date.now();
  const lastUser = getLatestUserMessageText(messages);
  const contextBlocks = cfg.useV2Protocol ? collectContextBlocks(messages, cfg) : [];
  const startUrl = cfg.useV2Protocol
    ? `${cfg.baseUrl}/api/plugin/v2/add/context`
    : `${cfg.baseUrl}/api/plugin/v1/add/message`;

  logSkillStage('Add][START', {
    req: requestId,
    url: startUrl,
    protocol: cfg.useV2Protocol ? 'v2' : 'v1',
    user_id: cfg.userId,
    agent_id: agentId,
    conversation_id: sessionId,
    messages: messages.length,
    roles: messages.map((message) => message.role),
    blocks: contextBlocks.map((block) => block.type),
    last_user: `"${truncate(lastUser, 80)}"`,
    scenario: cfg.scenario,
    api_key: maskSecretForLog(cfg.apiKey),
  });

  try {
    let saved;
    if (cfg.useV2Protocol) {
      try {
        saved = await addContextV2(messages, cfg, sessionId, requestId);
      } catch (error) {
        logSkillStage('Add][FALLBACK', {
          req: requestId,
          from: 'v2',
          to: 'v1',
          error: `"${truncate(error.message || String(error), 160)}"`,
        });
        saved = await addMemoryV1(messages, cfg, sessionId, requestId);
        saved.fallbackFrom = 'v2';
      }
    } else {
      saved = await addMemoryV1(messages, cfg, sessionId, requestId);
    }

    logSkillStage('Add][END', {
      req: requestId,
      success: true,
      protocol: saved.protocol,
      fallback_from: saved.fallbackFrom || '-',
      total_ms: Date.now() - requestStart,
      count: saved.result.memories_count || 0,
      server_req: saved.result.request_id,
      message: `"${truncate(saved.result.message || 'Memory saved successfully', 120)}"`,
    });

    return {
      ...saved,
      sessionId,
    };
  } catch (error) {
    logSkillStage('Add][END', {
      req: requestId,
      success: false,
      total_ms: Date.now() - requestStart,
      error: `"${truncate(error.message || String(error), 160)}"`,
    });
    throw error;
  }
}

/**
 * Recall memories based on query
 */
async function recallMemory(query, cliOptions = {}) {
  const cfg = await buildConfig(cliOptions);
  const effectiveQuery = normalizeSearchQuery(query) || String(query || '').trim();

  if (!cfg.apiKey) {
    console.error(JSON.stringify(buildMissingApiKeyError()));
    process.exit(1);
  }

  if (!cfg.recallEnabled) {
    console.log(JSON.stringify({
      success: true,
      count: 0,
      memories: [],
      message: 'Memory recall is disabled via HUMAN_LIKE_MEM_RECALL_ENABLED=false',
    }, null, 2));
    return;
  }

  const url = `${cfg.baseUrl}/api/plugin/v1/search/memory`;
  const requestId = buildRequestId();
  const requestStart = Date.now();
  const payload = {
    query: effectiveQuery,
    user_id: cfg.userId,
    agent_id: cfg.agentId,
    memory_limit_number: cfg.memoryLimitNumber,
    min_score: cfg.minScore,
    scenario: cfg.scenario,
    scenarios: cfg.scenario ? [cfg.scenario] : [],
  };
  logSkillStage('Search][START', {
    req: requestId,
    url,
    query: `"${truncate(effectiveQuery, 80)}"`,
    qlen: effectiveQuery.length,
    user_id: cfg.userId,
    agent_id: cfg.agentId,
    scenario: cfg.scenario,
    limit: cfg.memoryLimitNumber,
    min_score: cfg.minScore,
    api_key: maskSecretForLog(cfg.apiKey),
  });

  try {
    const result = await httpRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cfg.apiKey,
        'x-request-id': requestId,
        'x-plugin-version': SKILL_VERSION,
        'x-client-type': 'skill',
      },
      body: JSON.stringify(payload),
    }, cfg.timeoutMs);

    if (!result.success) {
      logSkillStage('Search][END', {
        req: requestId,
        success: false,
        total_ms: Date.now() - requestStart,
        error: `"${truncate(result.error || 'Memory retrieval failed', 160)}"`,
      });
      console.error(JSON.stringify({
        success: false,
        error: result.error || 'Memory retrieval failed',
      }));
      process.exit(1);
    }

    const memories = result.memories || [];

    // Format output for agent consumption
    const output = {
      success: true,
      count: memories.length,
      memories: memories.map(m => ({
        content: m.description || m.event || '',
        timestamp: m.timestamp,
        score: m.score,
      })),
    };

    // Also output human-readable format for context injection
    if (memories.length > 0) {
      output.context = formatMemoriesForContext(memories);
    }

    logSkillStage('Search][END', {
      req: requestId,
      success: true,
      count: memories.length,
      total_ms: Date.now() - requestStart,
      top: memoryPreviewSummary(memories),
    });
    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    logSkillStage('Search][END', {
      req: requestId,
      success: false,
      total_ms: Date.now() - requestStart,
      error: `"${truncate(error.message || String(error), 160)}"`,
    });
    console.error(JSON.stringify({
      success: false,
      error: error.message,
    }));
    process.exit(1);
  }
}

/**
 * Save messages to memory
 */
async function saveMemory(userMessage, assistantResponse, cliOptions = {}) {
  const cfg = await buildConfig(cliOptions);

  if (!cfg.apiKey) {
    console.error(JSON.stringify(buildMissingApiKeyError()));
    process.exit(1);
  }

  if (!cfg.addEnabled) {
    console.log(JSON.stringify({
      success: true,
      message: 'Memory storage is disabled via HUMAN_LIKE_MEM_ADD_ENABLED=false',
    }));
    return;
  }

  try {
    const normalized = normalizeMessages([
      { role: 'user', content: userMessage },
      { role: 'assistant', content: assistantResponse },
    ]);
    if (normalized.error) {
      console.error(JSON.stringify({
        success: false,
        error: normalized.error,
      }));
      process.exit(1);
    }

    const saved = await saveNormalizedMessages(normalized.messages, cfg);

    const output = {
      success: true,
      message: saved.protocol === 'v2'
        ? 'Memory saved successfully via procedural v2 context'
        : 'Memory saved successfully via legacy v1 message API',
      memoriesCount: saved.result.memories_count || 0,
      protocol: saved.protocol,
      fallbackFrom: saved.fallbackFrom || null,
    };
    console.log(JSON.stringify(output));
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: error.message,
    }));
    process.exit(1);
  }
}

/**
 * Search memories (alias for recall with different output format)
 */
async function searchMemory(query, cliOptions = {}) {
  await recallMemory(query, cliOptions);
}

/**
 * Read JSON from stdin
 */
async function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    const rl = createInterface({
      input: process.stdin,
      terminal: false,
    });

    rl.on('line', (line) => {
      data += line;
    });

    rl.on('close', () => {
      resolve(data.trim());
    });

    rl.on('error', reject);

    // Timeout after 5 seconds if no input
    setTimeout(() => {
      rl.close();
      if (!data) {
        reject(new Error('No input received from stdin'));
      }
    }, 5000);
  });
}

/**
 * Save batch messages to memory (from stdin JSON)
 */
async function saveBatchMemory(cliOptions = {}) {
  const cfg = await buildConfig(cliOptions);

  if (!cfg.apiKey) {
    console.error(JSON.stringify(buildMissingApiKeyError()));
    process.exit(1);
  }

  if (!cfg.addEnabled) {
    console.log(JSON.stringify({
      success: true,
      message: 'Memory storage is disabled via HUMAN_LIKE_MEM_ADD_ENABLED=false',
    }));
    return;
  }

  let inputData;
  try {
    inputData = await readStdin();
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: `Failed to read stdin: ${error.message}`,
      usage: 'echo \'[{"role":"user","content":"..."}, {"role":"assistant","content":"..."}]\' | node memory.mjs save-batch',
    }));
    process.exit(1);
  }

  let messages;
  try {
    messages = JSON.parse(inputData);
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: `Invalid JSON: ${error.message}`,
      received: inputData.substring(0, 200),
    }));
    process.exit(1);
  }

  const maxMessages = cfg.saveMaxMessages;
  const normalized = normalizeMessages(messages);
  if (normalized.error) {
    console.error(JSON.stringify({
      success: false,
      error: normalized.error,
      invalid: normalized.invalid,
    }));
    process.exit(1);
  }

  const messagesToSave = normalized.messages
    .slice(-maxMessages)
    .map((message) => {
      if (message.role === 'assistant') {
        return {
          ...message,
          content: truncate(message.content, 20000),
        };
      }
      if (message.role === 'tool') {
        return {
          ...message,
          content: truncate(message.content, 20000),
        };
      }
      return {
        ...message,
        content: truncate(message.content, 20000),
      };
    });

  try {
    const saved = await saveNormalizedMessages(messagesToSave, cfg);

    const turnCount = messagesToSave.filter((message) => message.role === 'user').length;
    const output = {
      success: true,
      message: `Saved ${turnCount || messagesToSave.length} turns/messages to memory via ${saved.protocol}`,
      memoriesCount: saved.result.memories_count || 0,
      protocol: saved.protocol,
      fallbackFrom: saved.fallbackFrom || null,
      config: {
        autoSaveEnabled: cfg.autoSaveEnabled,
        saveTriggerTurns: cfg.saveTriggerTurns,
        saveMaxMessages: cfg.saveMaxMessages,
      },
    };
    console.log(JSON.stringify(output));
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: error.message,
    }));
    process.exit(1);
  }
}

/**
 * Show current configuration (without sensitive data)
 */
async function showConfig(cliOptions = {}) {
  const cfg = await buildConfig(cliOptions);

  console.log(JSON.stringify({
    baseUrl: cfg.baseUrl,
    userId: cfg.userId,
    agentId: cfg.agentId,
    scenario: cfg.scenario,
    apiKeyConfigured: !!cfg.apiKey,
    memoryLimitNumber: cfg.memoryLimitNumber,
    minScore: cfg.minScore,
    timeoutMs: cfg.timeoutMs,
    recallEnabled: cfg.recallEnabled,
    addEnabled: cfg.addEnabled,
    autoSaveEnabled: cfg.autoSaveEnabled,
    saveTriggerTurns: cfg.saveTriggerTurns,
    saveMaxMessages: cfg.saveMaxMessages,
    useV2Protocol: cfg.useV2Protocol,
    captureToolCalls: cfg.captureToolCalls,
    mode: 'agent-smart',
  }, null, 2));
}

/**
 * Format memories for context injection (aligned with plugin format)
 */
function formatMemoriesForContext(memories) {
  if (!memories || memories.length === 0) return '';

  const now = Date.now();
  const nowText = formatTime(now);

  const memoryLines = memories
    .map(m => {
      const date = formatTime(m.timestamp);
      const content = m.description || m.event || '';
      const score = m.score ? ` (${(m.score * 100).toFixed(0)}%)` : '';
      if (!content) return '';
      if (date) return `   -[${date}] ${content}${score}`;
      return `   - ${content}${score}`;
    })
    .filter(Boolean);

  if (memoryLines.length === 0) return '';

  const lines = [
    '# Role',
    '',
    'You are an intelligent assistant with long-term memory capabilities. Your goal is to combine retrieved memory fragments to provide highly personalized, accurate, and logically rigorous responses.',
    '',
    '# System Context',
    '',
    `* Current Time: ${nowText} (Use this as the baseline for freshness checks)`,
    '',
    '# Memory Data',
    '',
    'Below are **episodic memory summaries** retrieved from long-term memory.',
    '',
    '* **Memory Type**: All memories are episodic summaries - they represent contextual information from past conversations.',
    '* **Special Note**: If content is tagged with \'[assistant_opinion]\' or \'[model_summary]\', it represents **past AI inference**, **not** direct user statements.',
    '',
    '```text',
    '<memories>',
    ...memoryLines,
    '</memories>',
    '```',
    '',
    '# Critical Protocol: Memory Safety',
    '',
    '1. **Source Verification**: Distinguish direct user statements from AI inference. AI summaries are reference-only.',
    '2. **Attribution Check**: Never attribute third-party info to the user.',
    '3. **Strong Relevance Check**: Only use memories that directly help answer the current query.',
    '4. **Freshness Check**: Prioritize the current query over conflicting memories.',
    '',
    '# Instructions',
    '',
    '1. **Review**: Read the episodic memory summaries and apply the protocol above to remove noise.',
    '2. **Execute**: Use only memories that pass filtering as context.',
    '3. **Output**: Answer directly. Never mention internal terms such as "memory store", "retrieval", or "AI opinions".',
  ];

  return lines.join('\n');
}

/**
 * Format timestamp for display
 */
function formatTime(value) {
  if (!value) return '';
  if (typeof value === 'number') {
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    const pad = (v) => String(v).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
  return String(value);
}

/**
 * Print usage information
 */
function printUsage() {
  console.log(`
Human-Like Memory CLI

Usage:
  node memory.mjs <command> [arguments] [flags]

Commands:
  recall <query>                    Retrieve relevant memories for a query
  save <user_msg> [assistant_msg]   Save a single conversation turn to memory
  save-batch                        Save multiple turns from stdin (JSON array)
  search <query>                    Search memories (alias for recall)
  config                            Show current configuration
  help                              Show this help text

Flags:
  --base-url <url>                  Override HUMAN_LIKE_MEM_BASE_URL
  --user-id <id>                    Override HUMAN_LIKE_MEM_USER_ID
  --agent-id <id>                   Override HUMAN_LIKE_MEM_AGENT_ID
  --scenario <name>                 Override HUMAN_LIKE_MEM_SCENARIO
  --memory-limit <n>                Override HUMAN_LIKE_MEM_LIMIT_NUMBER
  --min-score <float>               Override HUMAN_LIKE_MEM_MIN_SCORE
  --timeout-ms <n>                  Override HUMAN_LIKE_MEM_TIMEOUT_MS
  --recall-enabled <true|false>     Override HUMAN_LIKE_MEM_RECALL_ENABLED
  --add-enabled <true|false>        Override HUMAN_LIKE_MEM_ADD_ENABLED
  --auto-save-enabled <true|false>  Override HUMAN_LIKE_MEM_AUTO_SAVE_ENABLED
  --save-trigger-turns <n>          Override HUMAN_LIKE_MEM_SAVE_TRIGGER_TURNS
  --save-max-messages <n>           Override HUMAN_LIKE_MEM_SAVE_MAX_MESSAGES

Examples:
  node memory.mjs config
  node memory.mjs recall "What projects am I working on?"
  node memory.mjs recall "recent roadmap decisions" --user-id alice --agent-id main
  node memory.mjs save "I'm working on Project X" "Great, I'll remember that."
  echo '[{"role":"user","content":"Hi"},{"role":"assistant","content":"Hello!"}]' | node memory.mjs save-batch

OpenClaw setup:
  openclaw config set skills.entries.human-like-memory.enabled true --strict-json
  openclaw config set skills.entries.human-like-memory.apiKey "mp_xxx"
  openclaw config set skills.entries.human-like-memory.env.HUMAN_LIKE_MEM_BASE_URL "https://plugin.human-like.me"
  openclaw config set skills.entries.human-like-memory.env.HUMAN_LIKE_MEM_SCENARIO "human-like-memory-skill"

Hermes setup:
  hermes config set HUMAN_LIKE_MEM_API_KEY "mp_xxx"
  bash ~/.hermes/skills/human-like-memory/scripts/setup-hermes-provider.sh

Generic runtime setup:
  export HUMAN_LIKE_MEM_API_KEY="mp_xxx"
  export HUMAN_LIKE_MEM_BASE_URL="https://plugin.human-like.me"
  export HUMAN_LIKE_MEM_SCENARIO="human-like-memory-skill"
`);
}

async function main() {
  const parsed = parseCli(process.argv.slice(2));
  const [command, ...args] = parsed.positional;

  if (!command || parsed.options.help) {
    printUsage();
    process.exit(0);
  }

  switch (command) {
    case 'recall':
      if (!args[0]) {
        console.error('Error: Query is required for recall command');
        process.exit(1);
      }
      await recallMemory(args.join(' '), parsed.options);
      break;

    case 'save':
      if (!args[0]) {
        console.error('Error: At least one message is required for save command');
        process.exit(1);
      }
      await saveMemory(args[0], args[1], parsed.options);
      break;

    case 'save-batch':
      await saveBatchMemory(parsed.options);
      break;

    case 'search':
      if (!args[0]) {
        console.error('Error: Query is required for search command');
        process.exit(1);
      }
      await searchMemory(args.join(' '), parsed.options);
      break;

    case 'config':
      await showConfig(parsed.options);
      break;

    case 'help':
    case '--help':
    case '-h':
      printUsage();
      break;

    default:
      if (command) {
        console.error(`Unknown command: ${command}`);
      }
      printUsage();
      process.exit(1);
  }
}

await main().catch((error) => {
  console.error(JSON.stringify({
    success: false,
    error: error.message || String(error),
  }));
  process.exit(1);
});
