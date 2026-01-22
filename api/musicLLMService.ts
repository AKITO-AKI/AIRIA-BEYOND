/**
 * LLM-based music structure generation service (P4)
 * Generates classical music structure from intermediate representation
 */

import OpenAI from 'openai';
import type { GenerateMusicRequest, MusicStructure } from './types';

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/**
 * Generate music structure using LLM
 */
export async function generateMusicStructure(
  request: GenerateMusicRequest
): Promise<MusicStructure> {
  if (!openai) {
    throw new Error('OpenAI API key not configured');
  }

  const { valence, arousal, focus, motif_tags, duration = 75 } = request;

  // Build the system prompt for classical music generation
  const systemPrompt = `You are a classical music composition assistant specializing in generating structured music data based on emotional parameters.

Your task is to generate a JSON structure representing a classical music composition for solo piano.

Guidelines:
- Use classical composition principles (motifs, development, recapitulation)
- Use classical forms (ABA, sonata, rondo, theme-and-variations)
- Use functional harmony and proper cadences
- Avoid modern/pop music patterns

Emotional Parameter Interpretation:
- Valence (-1 to +1): negative = minor keys, descending motifs, darker harmonies; positive = major keys, ascending motifs, brighter harmonies
- Arousal (0 to 1): low = slower tempo, sparse texture, legato; high = faster tempo, rhythmic drive, forte dynamics
- Focus (0 to 1): influences structural clarity and development complexity

Output ONLY valid JSON with this exact structure:
{
  "key": "string (e.g., 'd minor', 'C major')",
  "tempo": number (BPM),
  "timeSignature": "string (e.g., '3/4', '4/4')",
  "form": "string (e.g., 'ABA', 'theme-variation', 'rondo')",
  "sections": [
    {
      "name": "string (e.g., 'A', 'B')",
      "measures": number,
      "chordProgression": ["array", "of", "roman", "numerals"],
      "melody": {
        "motifs": [
          {
            "degrees": [1, 3, 5, 3],
            "rhythm": [0.5, 0.5, 1, 1]
          }
        ]
      },
      "dynamics": "string (pp, p, mp, mf, f, ff)",
      "texture": "string (simple, contrapuntal, homophonic)"
    }
  ],
  "instrumentation": "piano",
  "character": "string describing emotional character",
  "reasoning": "brief explanation of why you chose this key, tempo, form, and other musical decisions"
}`;

  const userPrompt = `Generate a classical piano composition with the following emotional parameters:

Valence: ${valence.toFixed(2)} (${valence < -0.3 ? 'negative/sad' : valence > 0.3 ? 'positive/happy' : 'neutral'})
Arousal: ${arousal.toFixed(2)} (${arousal < 0.3 ? 'calm' : arousal > 0.7 ? 'energetic' : 'moderate'})
Focus: ${focus.toFixed(2)} (${focus < 0.3 ? 'diffuse' : focus > 0.7 ? 'concentrated' : 'balanced'})
Artistic motifs: ${motif_tags.join(', ')}
Target duration: ${duration} seconds

Create a composition that reflects these emotional qualities using classical music techniques.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in LLM response');
    }

    const musicStructure = JSON.parse(content) as MusicStructure;

    // Validate structure
    if (!musicStructure.key || !musicStructure.tempo || !musicStructure.sections) {
      throw new Error('Invalid music structure from LLM');
    }

    console.log('[MusicLLM] Generated music structure:', {
      key: musicStructure.key,
      tempo: musicStructure.tempo,
      form: musicStructure.form,
      sections: musicStructure.sections.length,
    });

    return musicStructure;
  } catch (error) {
    console.error('[MusicLLM] Error generating music structure:', error);
    throw error;
  }
}

/**
 * Generate music structure with fallback to rule-based generation
 */
export async function generateMusicStructureWithFallback(
  request: GenerateMusicRequest
): Promise<{ structure: MusicStructure; provider: 'openai' | 'rule-based' }> {
  try {
    const structure = await generateMusicStructure(request);
    return { structure, provider: 'openai' };
  } catch (error) {
    console.warn('[MusicLLM] Falling back to rule-based generation:', error);
    const structure = generateRuleBasedMusic(request);
    return { structure, provider: 'rule-based' };
  }
}

/**
 * Rule-based music generation fallback
 */
function generateRuleBasedMusic(request: GenerateMusicRequest): MusicStructure {
  const { valence, arousal, focus, motif_tags } = request;

  // Determine key based on valence
  const key = valence < 0 ? 'd minor' : 'C major';

  // Determine tempo based on arousal (40-160 BPM range)
  const tempo = Math.round(60 + arousal * 80);

  // Determine time signature based on focus
  const timeSignature = focus > 0.6 ? '4/4' : '3/4';

  // Determine form based on focus
  const form = focus > 0.5 ? 'ABA' : 'theme-variation';

  // Determine dynamics based on arousal
  const dynamics = arousal < 0.3 ? 'p' : arousal > 0.7 ? 'f' : 'mf';

  // Create simple sections
  const sections = [
    {
      name: 'A',
      measures: 8,
      chordProgression: valence < 0 ? ['i', 'iv', 'V', 'i'] : ['I', 'IV', 'V', 'I'],
      melody: {
        motifs: [
          {
            degrees: valence < 0 ? [5, 4, 3, 2, 1] : [1, 3, 5, 3, 1],
            rhythm: [1, 1, 1, 1, 2],
          },
        ],
      },
      dynamics,
      texture: 'simple',
    },
    {
      name: 'B',
      measures: 8,
      chordProgression: valence < 0 ? ['VI', 'iv', 'V', 'i'] : ['vi', 'IV', 'I', 'V'],
      melody: {
        motifs: [
          {
            degrees: [3, 5, 6, 5, 3],
            rhythm: [0.5, 0.5, 1, 1, 2],
          },
        ],
      },
      dynamics,
      texture: 'simple',
    },
  ];

  // Add return to A if form is ABA
  if (form === 'ABA') {
    sections.push({
      ...sections[0],
      name: 'A (reprise)',
    });
  }

  const character = `${valence < 0 ? 'melancholic' : 'uplifting'} and ${arousal < 0.5 ? 'calm' : 'energetic'}`;

  return {
    key,
    tempo,
    timeSignature,
    form,
    sections,
    instrumentation: 'piano',
    character,
  };
}
