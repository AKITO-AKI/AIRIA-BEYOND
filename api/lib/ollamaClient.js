import { debugAiConsole, debugAiLog } from './aiDebug.js';
import { parseJsonLoose } from './json.js';

function getBaseUrl() {
  const raw = process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
  return String(raw).replace(/\/$/, '');
}

function getDefaultModel() {
  return process.env.OLLAMA_MODEL || 'qwen2.5:7b-instruct';
}

function coerceTemperature(t) {
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function coerceNum(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : undefined;
}

export async function ollamaChat({
  model,
  messages,
  temperature,
  maxTokens,
  format,
  debugTag,
}) {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/chat`;
  const chosenModel = model || getDefaultModel();

  const body = {
    model: chosenModel,
    messages,
    stream: false,
  };

  if (format) body.format = format;

  const options = {};
  const temp = coerceTemperature(temperature);
  if (temp !== undefined) options.temperature = temp;

  // Ollama uses num_predict for max output tokens.
  const mt = coerceNum(maxTokens);
  if (mt !== undefined) options.num_predict = mt;

  if (Object.keys(options).length) body.options = options;

  debugAiConsole(`${debugTag || 'Ollama'}.request`, { url, body: { ...body, messages: `(${messages?.length ?? 0} msgs)` } });
  debugAiLog(`${debugTag || 'Ollama'}_request`, { url, body });

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await resp.text();
  debugAiConsole(`${debugTag || 'Ollama'}.response`, { status: resp.status, bodyPreview: text.slice(0, 500) });
  debugAiLog(`${debugTag || 'Ollama'}_response`, { status: resp.status, body: text });

  if (!resp.ok) {
    const err = new Error(`Ollama HTTP ${resp.status}: ${text.slice(0, 200)}`);
    err.status = resp.status;
    throw err;
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    const err = new Error('Ollama returned non-JSON response');
    err.status = resp.status;
    err.raw = text;
    throw err;
  }

  const content = json?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    const err = new Error('Ollama returned empty message content');
    err.status = resp.status;
    err.raw = json;
    throw err;
  }

  return {
    model: json.model,
    content,
    raw: json,
  };
}

export async function ollamaChatJson({
  system,
  user,
  messages,
  temperature,
  maxTokens,
  model,
  debugTag,
}) {
  const finalMessages = Array.isArray(messages)
    ? messages
    : [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: user },
      ];

  const out = await ollamaChat({
    model,
    messages: finalMessages,
    temperature,
    maxTokens,
    format: 'json',
    debugTag,
  });

  const parsed = parseJsonLoose(out.content);
  if (parsed == null) {
    const err = new Error('Ollama JSON parse failed (model did not return JSON)');
    err.raw = out.content;
    throw err;
  }
  return parsed;
}
