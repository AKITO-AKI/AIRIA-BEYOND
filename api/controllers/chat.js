/**
 * POST /api/chat
 * Daily conversation + recommendation.
 */

import { respondAndRecommend, shouldTriggerGenerationEvent } from '../conversationService.js';

export async function chatTurn(req, res) {
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

    const base = await respondAndRecommend({ messages, onboardingData });
    const event = shouldTriggerGenerationEvent(messages, onboardingData);

    return res.json({
      ...base,
      event_suggestion: event,
    });
  } catch (error) {
    console.error('[Chat] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
