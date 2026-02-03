/**
 * LLM-based music structure generation service (P4)
 * Generates classical music structure from intermediate representation
 */

import OpenAI from 'openai';
import { ollamaChatJson } from './lib/ollamaClient.js';

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function getProviderPreference() {
  return String(process.env.LLM_PROVIDER ?? '').toLowerCase();
}

function hasOllamaConfigured() {
  return !!(process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST || process.env.OLLAMA_MODEL);
}

/**
 * Generate music structure using LLM
 * @param {Object} request - Music generation request
 * @param {number} request.valence - Emotional valence (-1 to 1)
 * @param {number} request.arousal - Arousal level (0 to 1)
 * @param {number} request.focus - Focus level (0 to 1)
 * @param {string[]} request.motif_tags - Artistic motif tags
 * @param {number} [request.duration=180] - Target duration in seconds
 * @param {string[]} [request.genre_palette] - Allowed genres (event flow uses at least classical+jazz)
 * @param {string} [request.primary_genre] - Primary genre hint (classical|jazz|hybrid)
 * @param {string[]} [request.instrumentation] - Instrument list hint
 * @param {Object} [request.timbre_arc] - Timbre plan for early/middle/late
 * @param {Object} [request.theme] - Theme object (title/keywords)
 * @param {Array} [request.personality_axes] - Personality axes used for instrument choice
 * @returns {Promise<Object>} Music structure
 */
export async function generateMusicStructure(request) {
  const providerPref = getProviderPreference();
  if (providerPref !== 'openai' && (providerPref === 'ollama' || (!openai && hasOllamaConfigured()))) {
    const {
      valence,
      arousal,
      focus,
      motif_tags,
      duration = 180,
      genre_palette,
      primary_genre,
      instrumentation,
      timbre_arc,
      theme,
      personality_axes,
    } = request;

    const systemPrompt = `You are a music composition assistant specializing in generating structured music data based on emotional parameters.

Your task is to generate a JSON structure representing a composition that can be rendered by a single-track MIDI prototype.
Prefer piano-first writing, but you may describe broader instrumentation in the metadata when requested.

Guidelines:
- Default to classical composition principles (motifs, development, recapitulation)
- Use classical forms (ABA, sonata, rondo, theme-and-variations)
- Use functional harmony and proper cadences
- If jazz influence is requested/allowed, incorporate it subtly (extended harmony, gentle syncopation) while keeping the overall form coherent
- Avoid modern/pop music patterns

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
  "instrumentation": "string (e.g., 'piano' or 'piano trio')",
  "character": "string describing emotional character",
  "reasoning": "brief explanation of why you chose this key, tempo, form, and other musical decisions"
}`;

    const constraintsBlock = `\n\nCreative constraints (optional):\n- Allowed genres: ${Array.isArray(genre_palette) && genre_palette.length ? genre_palette.join(', ') : 'classical'}\n- Primary genre hint: ${primary_genre || 'classical'}\n- Instrumentation hint: ${Array.isArray(instrumentation) && instrumentation.length ? instrumentation.join(', ') : 'piano'}\n- Timbre arc: ${timbre_arc ? JSON.stringify(timbre_arc) : 'n/a'}\n- Theme: ${theme ? JSON.stringify({ title: theme.title, keywords: theme.keywords }) : 'n/a'}\n- Personality axes: ${Array.isArray(personality_axes) ? JSON.stringify(personality_axes.slice(0, 3)) : 'n/a'}\n`;

    const userPrompt = `Generate a composition with the following emotional parameters:\n\nValence: ${Number(valence).toFixed(2)}\nArousal: ${Number(arousal).toFixed(2)}\nFocus: ${Number(focus).toFixed(2)}\nArtistic motifs: ${Array.isArray(motif_tags) ? motif_tags.join(', ') : ''}\nTarget duration: ${duration} seconds\n\nCreate a composition that reflects these emotional qualities, staying within the allowed genre palette and respecting the timbre arc when provided.${constraintsBlock}`;

    const musicStructure = await ollamaChatJson({
      system: systemPrompt,
      user: userPrompt,
      temperature: 0.8,
      maxTokens: 1800,
      model: process.env.OLLAMA_MODEL_MUSIC || process.env.OLLAMA_MODEL,
      debugTag: 'MusicLLM',
    });

    if (!musicStructure?.key || !musicStructure?.tempo || !musicStructure?.sections) {
      throw new Error('Invalid music structure from Ollama');
    }

    console.log('[MusicLLM] Generated music structure (ollama):', {
      key: musicStructure.key,
      tempo: musicStructure.tempo,
      form: musicStructure.form,
      sections: Array.isArray(musicStructure.sections) ? musicStructure.sections.length : 0,
    });

    return musicStructure;
  }

  if (!openai) {
    throw new Error('OpenAI API key not configured');
  }

  const {
    valence,
    arousal,
    focus,
    motif_tags,
    duration = 180,
    genre_palette,
    primary_genre,
    instrumentation,
    timbre_arc,
    theme,
    personality_axes,
  } = request;

  // Build the system prompt for music generation
  const systemPrompt = `You are a music composition assistant specializing in generating structured music data based on emotional parameters.

Your task is to generate a JSON structure representing a composition that can be rendered by a single-track MIDI prototype.
Prefer piano-first writing, but you may describe broader instrumentation in the metadata when requested.

Guidelines:
- Default to classical composition principles (motifs, development, recapitulation)
- Use classical forms (ABA, sonata, rondo, theme-and-variations)
- Use functional harmony and proper cadences
- If jazz influence is requested/allowed, incorporate it subtly (extended harmony, gentle syncopation) while keeping the overall form coherent
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
  "instrumentation": "string (e.g., 'piano' or 'piano trio')",
  "character": "string describing emotional character",
  "reasoning": "brief explanation of why you chose this key, tempo, form, and other musical decisions"
}`;

  const constraintsBlock = `\n\nCreative constraints (optional):\n- Allowed genres: ${Array.isArray(genre_palette) && genre_palette.length ? genre_palette.join(', ') : 'classical'}\n- Primary genre hint: ${primary_genre || 'classical'}\n- Instrumentation hint: ${Array.isArray(instrumentation) && instrumentation.length ? instrumentation.join(', ') : 'piano'}\n- Timbre arc: ${timbre_arc ? JSON.stringify(timbre_arc) : 'n/a'}\n- Theme: ${theme ? JSON.stringify({ title: theme.title, keywords: theme.keywords }) : 'n/a'}\n- Personality axes: ${Array.isArray(personality_axes) ? JSON.stringify(personality_axes.slice(0, 3)) : 'n/a'}\n`;

  const userPrompt = `Generate a composition with the following emotional parameters:

Valence: ${valence.toFixed(2)} (${valence < -0.3 ? 'negative/sad' : valence > 0.3 ? 'positive/happy' : 'neutral'})
Arousal: ${arousal.toFixed(2)} (${arousal < 0.3 ? 'calm' : arousal > 0.7 ? 'energetic' : 'moderate'})
Focus: ${focus.toFixed(2)} (${focus < 0.3 ? 'diffuse' : focus > 0.7 ? 'concentrated' : 'balanced'})
Artistic motifs: ${motif_tags.join(', ')}
Target duration: ${duration} seconds

Create a composition that reflects these emotional qualities, staying within the allowed genre palette and respecting the timbre arc when provided.${constraintsBlock}`;

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

    const musicStructure = JSON.parse(content);

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
 * @param {Object} request - Music generation request
 * @returns {Promise<Object>} Music structure and provider info
 */
export async function generateMusicStructureWithFallback(request) {
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
 * @param {Object} request - Music generation request
 * @returns {Object} Music structure
 */
function generateRuleBasedMusic(request) {
  const { valence, arousal, focus, motif_tags, instrumentation, primary_genre } = request;

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
    instrumentation: Array.isArray(instrumentation) && instrumentation.length
      ? instrumentation.join(', ')
      : primary_genre === 'jazz'
      ? 'piano (jazz-influenced)'
      : 'piano',
    character,
  };
}
