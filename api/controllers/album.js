/**
 * POST /api/album/name
 *
 * Generate a short, human-friendly Japanese album title.
 * - If OpenAI is configured, uses the model.
 * - Otherwise, falls back to a deterministic rule-based name.
 */

import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function fallbackTitle({ mood, motifTags = [] }) {
  const safeMood = String(mood || '').trim() || '記憶';
  const tag = Array.isArray(motifTags) && motifTags.length > 0 ? String(motifTags[0]).trim() : '';
  if (tag) return `${safeMood}の${tag}`.slice(0, 24);
  return `${safeMood}のアルバム`.slice(0, 24);
}

function normalizeString(x, max = 2000) {
  return String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export async function nameAlbumTitle(req, res) {
  try {
    const mood = normalizeString(req.body?.mood, 80);
    const motifTags = Array.isArray(req.body?.motifTags) ? req.body.motifTags.slice(0, 12).map((t) => normalizeString(t, 40)) : [];
    const character = normalizeString(req.body?.character, 120);
    const brief = req.body?.brief ? JSON.stringify(req.body.brief).slice(0, 1200) : '';
    const messages = Array.isArray(req.body?.messages) ? req.body.messages.slice(-12) : [];

    if (!mood) {
      return res.status(400).json({ error: 'Missing required field', message: 'mood is required' });
    }

    if (!openai) {
      return res.json({ title: fallbackTitle({ mood, motifTags }), provider: 'rule-based' });
    }

    const system = `あなたはアルバムのタイトル命名者です。

要件:
- 日本語のタイトルを1つ提案。
- 6〜18文字程度（長くても24文字まで）。
- 記号や絵文字は使わない（「・」や「―」も基本なし）。
- 既存の有名曲やアルバム名の丸写しは避け、オリジナルに。
- 出力はJSONのみ。

出力形式:
{ "title": "string" }`;

    const user = {
      mood,
      motifTags,
      character: character || undefined,
      brief: brief || undefined,
      messages,
    };

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(user) },
      ],
      temperature: 0.8,
      response_format: { type: 'json_object' },
      max_tokens: 120,
    });

    const content = completion?.choices?.[0]?.message?.content;
    if (!content) {
      return res.json({ title: fallbackTitle({ mood, motifTags }), provider: 'rule-based' });
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return res.json({ title: fallbackTitle({ mood, motifTags }), provider: 'rule-based' });
    }

    const title = normalizeString(parsed?.title, 60).replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu, '');
    const cleaned = title.replace(/[\u0000-\u001f]/g, '').replace(/[!"#$%&'()*+,./:;<=>?@[\\\]^_`{|}~]/g, '').trim();

    return res.json({
      title: cleaned || fallbackTitle({ mood, motifTags }),
      provider: 'openai',
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
