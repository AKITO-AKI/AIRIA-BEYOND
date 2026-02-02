/**
 * POST /api/event/refine
 * Converts conversation logs to generation inputs (music + image) without requiring user choices.
 */

import { generateCreativeBrief, briefToGenerationInputs } from '../creativeBriefService.js';

export async function refineGenerationEvent(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, onboardingData } = req.body ?? {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'messages[] is required',
      });
    }

    const { brief, provider } = await generateCreativeBrief({ messages, onboardingData });
    const inputs = briefToGenerationInputs(brief);

    return res.json({
      provider,
      ...inputs,
    });
  } catch (error) {
    console.error('[EventRefine] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
