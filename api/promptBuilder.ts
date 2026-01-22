/**
 * Style Presets and Prompt Builder (P3 Enhanced)
 * 
 * Converts intermediate representation (IR) to coherent SDXL prompts
 * with classic aesthetic style presets
 * 
 * P3 enhancements:
 * - Uses valence (-1 to 1) for mood/atmosphere descriptors
 * - Uses arousal (0 to 1) for energy/intensity descriptors
 * - Uses focus (0 to 1) for composition clarity
 * - Auto-selects style preset based on valence/arousal
 */

export interface StylePreset {
  name: string;
  promptSuffix: string;
  negativePrompt: string;
  // P3: Style preset metadata for auto-selection
  valenceRange?: [number, number]; // preferred valence range
  arousalRange?: [number, number]; // preferred arousal range
}

export const STYLE_PRESETS: Record<string, StylePreset> = {
  'oil-painting': {
    name: '油絵 (Oil Painting)',
    promptSuffix: 'oil painting, thick brushstrokes, rich texture, classical oil painting, masterpiece, fine art',
    negativePrompt: 'modern, digital, 3D render, photo, text, watermark, realistic photograph',
    valenceRange: [-0.3, 0.7], // moderate to positive
    arousalRange: [0.3, 0.7], // balanced energy
  },
  'watercolor': {
    name: '水彩画 (Watercolor)',
    promptSuffix: 'watercolor painting, soft edges, translucent layers, watercolor on paper, delicate, flowing colors',
    negativePrompt: 'harsh lines, digital art, 3D render, photo, text, watermark',
    valenceRange: [0.2, 1.0], // positive, uplifting
    arousalRange: [0.0, 0.5], // calm to moderate
  },
  'impressionism': {
    name: '印象派 (Impressionism)',
    promptSuffix: 'impressionist landscape painting, light-focused, loose brushwork, impressionist style, natural scenery, atmospheric',
    negativePrompt: 'sharp edges, photorealistic, modern, digital art, text, watermark',
    valenceRange: [0.0, 1.0], // neutral to positive
    arousalRange: [0.2, 0.6], // gentle to moderate
  },
  'abstract-minimal': {
    name: '抽象ミニマル (Abstract Minimal)',
    promptSuffix: 'minimal abstract art, monochrome gradient, geometric calm, clean composition, modernist aesthetic',
    negativePrompt: 'busy, ornate, realistic, detailed faces, text, watermark, cluttered',
    valenceRange: [-0.5, 0.5], // neutral range
    arousalRange: [0.0, 0.4], // calm, meditative
  },
  'romantic-landscape': {
    name: 'ロマン派風景 (Romantic Landscape)',
    promptSuffix: 'romantic landscape painting, dramatic sky, sublime nature, 19th century landscape, classical composition, oil on canvas',
    negativePrompt: 'modern, minimal, abstract, photography, text, watermark',
    valenceRange: [-0.5, 0.5], // dramatic range
    arousalRange: [0.5, 1.0], // intense, dynamic
  },
};

// Mood keys for consistency
export const MOOD_KEYS = {
  CALM: '穏やか',
  HAPPY: '嬉しい',
  ANXIOUS: '不安',
  TIRED: '疲れ',
} as const;

// Mood to descriptive terms mapping
const MOOD_DESCRIPTORS: Record<string, string> = {
  [MOOD_KEYS.CALM]: 'calm, peaceful, serene, tranquil, gentle',
  [MOOD_KEYS.HAPPY]: 'joyful, vibrant, energetic, bright, uplifting',
  [MOOD_KEYS.ANXIOUS]: 'anxious, turbulent, uncertain, tense, restless',
  [MOOD_KEYS.TIRED]: 'tired, muted, subdued, melancholic, quiet',
};

/**
 * Map valence (-1 to 1) to atmosphere/mood keywords
 * valence: -1 = dark/melancholic, 0 = neutral, +1 = bright/uplifting
 */
function getValenceDescriptors(valence: number): string {
  if (valence < -0.5) {
    return 'dark atmosphere, melancholic, somber tones, shadowy, moody';
  } else if (valence < -0.2) {
    return 'subdued, contemplative, muted colors, quiet mood';
  } else if (valence < 0.2) {
    return 'balanced, neutral tones, harmonious';
  } else if (valence < 0.5) {
    return 'pleasant, warm tones, hopeful, gentle light';
  } else {
    return 'bright, uplifting, radiant, luminous, joyful atmosphere';
  }
}

/**
 * Map arousal (0 to 1) to energy/intensity keywords
 * arousal: 0 = calm/still, 0.5 = moderate, 1 = intense/dynamic
 */
function getArousalDescriptors(arousal: number): string {
  if (arousal < 0.3) {
    return 'calm, still, peaceful, serene, quiet, gentle';
  } else if (arousal < 0.6) {
    return 'moderate energy, flowing, rhythmic, balanced movement';
  } else {
    return 'intense, dynamic, energetic, powerful, dramatic, vigorous';
  }
}

/**
 * Map focus (0 to 1) to compositional clarity keywords
 * focus: 0 = diffuse/abstract, 1 = clear/sharp composition
 */
function getFocusDescriptors(focus: number): string {
  if (focus < 0.3) {
    return 'soft focus, dreamlike, ethereal, diffused, atmospheric haze';
  } else if (focus < 0.7) {
    return 'balanced composition, medium clarity, artistic detail';
  } else {
    return 'sharp composition, clear details, well-defined, crisp, focused';
  }
}

// Duration to complexity mapping
function getComplexityDescriptor(durationSec: number): string {
  if (durationSec < 60) return 'simple, minimalist';
  if (durationSec < 120) return 'balanced, moderate detail';
  return 'complex, intricate, detailed';
}

/**
 * Auto-select style preset based on valence and arousal
 * This provides intelligent defaults when user doesn't select manually
 */

// Thresholds for auto-style selection
const AROUSAL_LOW_THRESHOLD = 0.4;
const AROUSAL_HIGH_THRESHOLD = 0.6;
const VALENCE_POSITIVE_THRESHOLD = 0.3;
const VALENCE_NEUTRAL_THRESHOLD = 0.2;

export function autoSelectStylePreset(valence: number, arousal: number): string {
  // Low arousal + neutral/positive valence → watercolor or abstract-minimal
  if (arousal < AROUSAL_LOW_THRESHOLD) {
    if (valence > VALENCE_POSITIVE_THRESHOLD) {
      return 'watercolor'; // calm, positive → soft watercolor
    } else {
      return 'abstract-minimal'; // calm, neutral/negative → minimal abstract
    }
  }
  
  // High arousal → romantic-landscape
  if (arousal > AROUSAL_HIGH_THRESHOLD) {
    return 'romantic-landscape'; // intense, dramatic
  }
  
  // Mid-range arousal
  if (valence > VALENCE_NEUTRAL_THRESHOLD) {
    return 'impressionism'; // moderate energy, positive → impressionist
  } else {
    return 'oil-painting'; // moderate energy, neutral/negative → oil painting
  }
}

/**
 * Build a prompt from session IR data (P3 Enhanced)
 * Now uses valence, arousal, and focus for richer prompt generation
 */
export function buildPrompt(params: {
  mood?: string;
  duration?: number;
  motifTags?: string[];
  stylePreset?: string;
  // P3: New IR parameters
  valence?: number;
  arousal?: number;
  focus?: number;
}): { prompt: string; negativePrompt: string } {
  const { 
    mood, 
    duration = 60, 
    motifTags = [], 
    stylePreset,
    valence,
    arousal,
    focus 
  } = params;
  
  // Auto-select style if not provided and we have IR data
  let selectedPreset = stylePreset;
  if (!selectedPreset && valence !== undefined && arousal !== undefined) {
    selectedPreset = autoSelectStylePreset(valence, arousal);
  }
  
  const preset = STYLE_PRESETS[selectedPreset || 'oil-painting'] || STYLE_PRESETS['oil-painting'];
  
  // Build prompt components
  const components: string[] = [];
  
  // P3: Use IR data if available (takes precedence over mood)
  if (valence !== undefined) {
    components.push(getValenceDescriptors(valence));
  } else if (mood && MOOD_DESCRIPTORS[mood]) {
    // Fallback to mood descriptors
    components.push(MOOD_DESCRIPTORS[mood]);
  }
  
  if (arousal !== undefined) {
    components.push(getArousalDescriptors(arousal));
  }
  
  if (focus !== undefined) {
    components.push(getFocusDescriptors(focus));
  }
  
  // Add complexity based on duration
  components.push(getComplexityDescriptor(duration));
  
  // Add motif tags if provided (from P2 analysis)
  if (motifTags.length > 0) {
    // Translate common Japanese motif tags to English for SDXL
    const translatedTags = motifTags.map(tag => translateMotifTag(tag));
    components.push(translatedTags.join(', '));
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
 * P5: Generate reasoning for why this prompt/style was chosen
 */
export function generatePromptReasoning(params: {
  valence?: number;
  arousal?: number;
  focus?: number;
  stylePreset?: string;
  motifTags?: string[];
}): string {
  const { valence, arousal, focus, stylePreset, motifTags = [] } = params;
  
  const reasons: string[] = [];
  
  // Explain valence choice
  if (valence !== undefined) {
    if (valence < -0.3) {
      reasons.push('低いvalence（不快な感情）から暗めの雰囲気を選択');
    } else if (valence > 0.3) {
      reasons.push('高いvalence（快適な感情）から明るく希望的な雰囲気を選択');
    } else {
      reasons.push('中程度のvalenceからバランスの取れた雰囲気を選択');
    }
  }
  
  // Explain arousal choice
  if (arousal !== undefined) {
    if (arousal < 0.3) {
      reasons.push('低いarousal（穏やか）から静的で柔らかな表現を選択');
    } else if (arousal > 0.7) {
      reasons.push('高いarousal（興奮）からダイナミックで力強い表現を選択');
    } else {
      reasons.push('中程度のarrousalから適度なエネルギーの表現を選択');
    }
  }
  
  // Explain style choice
  if (stylePreset) {
    const presetInfo = STYLE_PRESETS[stylePreset];
    if (presetInfo) {
      reasons.push(`${presetInfo.name}スタイルを選択し、感情に合った芸術的表現を実現`);
    }
  }
  
  // Mention motif tags
  if (motifTags.length > 0) {
    reasons.push(`モチーフタグ（${motifTags.join('、')}）を使用して具体的なイメージを生成`);
  }
  
  return reasons.join('。') + '。';
}

/**
 * Translate Japanese motif tags to English for SDXL
 * (P2 analysis returns Japanese tags like 光, 霧, etc.)
 */
function translateMotifTag(tag: string): string {
  const translations: Record<string, string> = {
    '光': 'light',
    '影': 'shadow',
    '霧': 'mist',
    '水面': 'water surface',
    '薄明': 'twilight',
    '荘厳': 'majestic',
    '孤独': 'solitude',
    '凪': 'calm waters',
    '静寂': 'tranquility',
    '希望': 'hope',
    '朝焼け': 'sunrise',
    '夕暮れ': 'sunset',
    '森': 'forest',
    '空': 'sky',
    '雲': 'clouds',
    // Music terms
    'レガート': 'flowing',
    'スタッカート': 'punctuated',
    'アレグロ': 'lively',
    'アダージョ': 'slow tempo',
    'フォルテ': 'strong',
    'ピアニシモ': 'very soft',
  };
  
  return translations[tag] || tag;
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
