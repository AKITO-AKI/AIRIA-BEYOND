/**
 * Style Presets and Prompt Builder
 * 
 * Converts intermediate representation (IR) to coherent SDXL prompts
 * with classic aesthetic style presets
 */

export interface StylePreset {
  name: string;
  promptSuffix: string;
  negativePrompt: string;
}

export const STYLE_PRESETS: Record<string, StylePreset> = {
  'abstract-oil': {
    name: '抽象油絵 (Abstract Oil Painting)',
    promptSuffix: 'abstract oil painting, thick brushstrokes, rich textures, expressive colors, modern art style, museum quality',
    negativePrompt: 'photorealistic, photography, realistic, detailed faces, text, watermark',
  },
  'impressionist': {
    name: '印象派風景 (Impressionist Landscape)',
    promptSuffix: 'impressionist landscape painting, soft brushwork, natural light, pastoral scene, claude monet style, plein air',
    negativePrompt: 'sharp edges, photorealistic, modern, digital art, text, watermark',
  },
  'romantic-landscape': {
    name: 'ロマン派風景 (Classical Romantic Landscape)',
    promptSuffix: 'romantic landscape painting, dramatic sky, sublime nature, classical composition, JMW Turner style, oil on canvas',
    negativePrompt: 'modern, minimal, abstract, photography, text, watermark',
  },
  'minimal-abstract': {
    name: 'ミニマル抽象 (Monochrome Minimal Abstract)',
    promptSuffix: 'minimal abstract art, monochromatic, geometric shapes, clean composition, modernist, high contrast',
    negativePrompt: 'busy, colorful, realistic, detailed, ornate, text, watermark',
  },
};

// Mood to descriptive terms mapping
const MOOD_DESCRIPTORS: Record<string, string> = {
  '穏やか': 'calm, peaceful, serene, tranquil, gentle',
  '嬉しい': 'joyful, vibrant, energetic, bright, uplifting',
  '不安': 'anxious, turbulent, uncertain, tense, restless',
  '疲れ': 'tired, muted, subdued, melancholic, quiet',
};

// Duration to complexity mapping
function getComplexityDescriptor(durationSec: number): string {
  if (durationSec < 60) return 'simple, minimalist';
  if (durationSec < 120) return 'balanced, moderate detail';
  return 'complex, intricate, detailed';
}

/**
 * Build a prompt from session IR data
 */
export function buildPrompt(params: {
  mood?: string;
  duration?: number;
  motifTags?: string[];
  stylePreset?: string;
}): { prompt: string; negativePrompt: string } {
  const { mood, duration = 60, motifTags = [], stylePreset = 'abstract-oil' } = params;
  
  const preset = STYLE_PRESETS[stylePreset] || STYLE_PRESETS['abstract-oil'];
  
  // Build prompt components
  const components: string[] = [];
  
  // Add mood descriptors
  if (mood && MOOD_DESCRIPTORS[mood]) {
    components.push(MOOD_DESCRIPTORS[mood]);
  }
  
  // Add complexity based on duration
  components.push(getComplexityDescriptor(duration));
  
  // Add motif tags if provided
  if (motifTags.length > 0) {
    components.push(motifTags.join(', '));
  }
  
  // Combine with style preset
  const basePrompt = components.join(', ');
  const fullPrompt = `${basePrompt}, ${preset.promptSuffix}`;
  
  return {
    prompt: fullPrompt,
    negativePrompt: preset.negativePrompt,
  };
}

/**
 * Get list of available style presets for UI
 */
export function getStylePresetsList(): Array<{ id: string; name: string }> {
  return Object.entries(STYLE_PRESETS).map(([id, preset]) => ({
    id,
    name: preset.name,
  }));
}
