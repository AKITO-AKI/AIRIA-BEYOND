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

export const STYLE_PRESETS = {
  'white-world': {
    name: '白の世界 (White World)'
    ,
    promptSuffix:
      'minimalist album cover, white matte paper, gallery framing, soft diffuse light, porcelain texture, frosted glass atmosphere, subtle grain, elegant negative space, fine art, masterpiece',
    negativePrompt:
      'text, watermark, logo, signature, typography, modern ui, screenshot, low quality, blurry, noisy artifacts, oversaturated, harsh contrast',
    valenceRange: [-1.0, 1.0],
    arousalRange: [0.0, 1.0],
  },
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

function envStr(name) {
  return String(process.env[name] ?? '').trim();
}

function getDefaultStylePresetId() {
  const v = envStr('IMAGE_DEFAULT_STYLE_PRESET');
  return v || '';
}

function isWhiteWorldOverlayEnabled() {
  const v = envStr('IMAGE_WHITE_WORLD_OVERLAY').toLowerCase();
  if (!v) return false;
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function getWhiteWorldOverlay() {
  return {
    prompt:
      'white world aesthetic, clean ceramic base, paper-like texture, frosted glass haze, subtle micro-grain, minimal composition, high-end gallery print',
    negative:
      'text, letters, watermark, logo, signature, ui elements, borders with text, poster typography, clutter',
  };
}

// Mood keys for consistency
export const MOOD_KEYS = {
  CALM: '穏やか',
  HAPPY: '嬉しい',
  ANXIOUS: '不安',
  TIRED: '疲れ',
};

// Mood to descriptive terms mapping
const MOOD_DESCRIPTORS = {
  [MOOD_KEYS.CALM]: 'calm, peaceful, serene, tranquil, gentle',
  [MOOD_KEYS.HAPPY]: 'joyful, vibrant, energetic, bright, uplifting',
  [MOOD_KEYS.ANXIOUS]: 'anxious, turbulent, uncertain, tense, restless',
  [MOOD_KEYS.TIRED]: 'tired, muted, subdued, melancholic, quiet',
};

/**
 * Map valence (-1 to 1) to atmosphere/mood keywords
 * valence: -1 = dark/melancholic, 0 = neutral, +1 = bright/uplifting
 * @param {number} valence - Valence value
 * @returns {string} Atmosphere descriptors
 */
function getValenceDescriptors(valence) {
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
 * @param {number} arousal - Arousal value
 * @returns {string} Energy descriptors
 */
function getArousalDescriptors(arousal) {
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
 * @param {number} focus - Focus value
 * @returns {string} Composition descriptors
 */
function getFocusDescriptors(focus) {
  if (focus < 0.3) {
    return 'soft focus, dreamlike, ethereal, diffused, atmospheric haze';
  } else if (focus < 0.7) {
    return 'balanced composition, medium clarity, artistic detail';
  } else {
    return 'sharp composition, clear details, well-defined, crisp, focused';
  }
}

/**
 * Duration to complexity mapping
 * @param {number} durationSec - Duration in seconds
 * @returns {string} Complexity descriptor
 */
function getComplexityDescriptor(durationSec) {
  if (durationSec < 60) return 'simple, minimalist';
  if (durationSec < 120) return 'balanced, moderate detail';
  return 'complex, intricate, detailed';
}

/**
 * Auto-select style preset based on valence and arousal
 * This provides intelligent defaults when user doesn't select manually
 * @param {number} valence - Valence value
 * @param {number} arousal - Arousal value
 * @returns {string} Selected style preset ID
 */
export function autoSelectStylePreset(valence, arousal) {
  // Thresholds for auto-style selection
  const AROUSAL_LOW_THRESHOLD = 0.4;
  const AROUSAL_HIGH_THRESHOLD = 0.6;
  const VALENCE_POSITIVE_THRESHOLD = 0.3;
  const VALENCE_NEUTRAL_THRESHOLD = 0.2;

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
 * @param {Object} params - Prompt parameters
 * @param {string} [params.mood] - User mood
 * @param {number} [params.duration=60] - Session duration in seconds
 * @param {string[]} [params.motifTags=[]] - Artistic motif tags
 * @param {string} [params.stylePreset] - Style preset ID
 * @param {number} [params.valence] - Valence value
 * @param {number} [params.arousal] - Arousal value
 * @param {number} [params.focus] - Focus value
 * @param {string} [params.subject] - Subject hints (comma-separated)
 * @param {string} [params.palette] - Color palette hints (comma-separated)
 * @param {number} [params.ambiguity] - 0..1 (1=very abstract/ambiguous)
 * @returns {Object} Prompt and negative prompt
 */
export function buildPrompt(params) {
  const { 
    mood, 
    duration = 60, 
    motifTags = [], 
    stylePreset,
    valence,
    arousal,
    focus,
    subject,
    palette,
    ambiguity,
    key,
    period,
    instrumentation,
    density,
  } = params;
  
  // Auto-select style if not provided and we have IR data
  let selectedPreset = stylePreset;
  if (!selectedPreset) {
    const def = getDefaultStylePresetId();
    if (def) selectedPreset = def;
  }
  if (!selectedPreset && valence !== undefined && arousal !== undefined) {
    selectedPreset = autoSelectStylePreset(valence, arousal);
  }
  
  const preset = STYLE_PRESETS[selectedPreset || 'oil-painting'] || STYLE_PRESETS['oil-painting'];
  
  // Build prompt components
  const components = [];

  // Art-historical mapping from music period (optional)
  const periodArt = getArtHistoricalDirection(period);
  if (periodArt) components.push(periodArt);

  // Synesthesia mapping: musical key → dominant colors
  const keyDir = getSynestheticKeyColorDirection(key);
  if (keyDir) components.push(keyDir);

  // Synesthesia mapping: instrumentation → texture/material vocabulary
  const instDir = getSynestheticInstrumentationDirection(instrumentation);
  if (instDir) components.push(instDir);

  // Density (0..1): unify "busy vs empty" across modalities
  const resolvedDensity = typeof density === 'number' && Number.isFinite(density)
    ? Math.max(0, Math.min(1, density))
    : arousal !== undefined && focus !== undefined
      ? Math.max(0, Math.min(1, 0.55 * arousal + 0.35 * focus))
      : undefined;
  if (resolvedDensity !== undefined) {
    components.push(resolvedDensity < 0.33
      ? 'minimal, spacious, generous negative space, few elements'
      : resolvedDensity < 0.66
        ? 'balanced detail, tasteful ornament, curated composition'
        : 'dense detail, intricate textures, layered symbolism, rich micro-structure');
  }

  // Refined brief additions (kept optional)
  if (subject) {
    const safeSubject = abstractifySubject(String(subject));
    if (safeSubject) components.push(`subject hints: ${safeSubject}`);
  }
  if (palette) {
    components.push(`color palette: ${palette}`);
  }
  
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
  
  // Ambiguity can override focus (more ambiguity => more diffuse composition)
  const resolvedFocus = focus !== undefined
    ? focus
    : ambiguity !== undefined
    ? Math.max(0, Math.min(1, 1 - ambiguity))
    : undefined;

  if (resolvedFocus !== undefined) {
    components.push(getFocusDescriptors(resolvedFocus));
  }
  
  // Add complexity based on duration
  components.push(getComplexityDescriptor(duration));
  
  // Add motif tags if provided (from P2 analysis)
  if (motifTags.length > 0) {
    // Translate common Japanese motif tags to English for SDXL
    const translatedTags = motifTags.map(tag => translateMotifTag(tag));
    const objectiveHints = objectiveCorrelativeHints(motifTags);
    components.push(translatedTags.join(', '));
    if (objectiveHints) components.push(objectiveHints);
  }
  
  // Combine with style preset
  const basePrompt = components.join(', ');
  let fullPrompt = `${basePrompt}, ${preset.promptSuffix}`;
  let fullNegative = preset.negativePrompt;

  if (isWhiteWorldOverlayEnabled() && selectedPreset !== 'white-world') {
    const overlay = getWhiteWorldOverlay();
    fullPrompt = `${overlay.prompt}, ${fullPrompt}`;
    fullNegative = `${fullNegative}, ${overlay.negative}`;
  }
  
  return {
    prompt: fullPrompt,
    negativePrompt: fullNegative,
    stylePreset: selectedPreset || 'oil-painting',
  };
}

function getSynestheticKeyColorDirection(key) {
  const parsed = parseMusicalKey(key);
  if (!parsed) return '';
  const { tonic, mode } = parsed;

  // A pragmatic mapping inspired by common synesthetic associations (e.g., Scriabin-like tables)
  // tuned for classical jacket art direction.
  const MAJOR = {
    C: 'pure white, pearl, luminous neutral',
    'C#': 'violet, electric purple, iridescent',
    Db: 'violet, electric purple, iridescent',
    D: 'golden yellow, warm light, champagne',
    Eb: 'steel blue, smoky indigo',
    'D#': 'steel blue, smoky indigo',
    E: 'bright cyan, crystalline turquoise',
    F: 'soft green, pastoral jade',
    'F#': 'deep blue, ultramarine, silver',
    Gb: 'deep blue, ultramarine, silver',
    G: 'amber, honey, sunlit ochre',
    Ab: 'rose, magenta, velvet red',
    'G#': 'rose, magenta, velvet red',
    A: 'spring green, fresh emerald',
    Bb: 'warm brown, sepia, antique parchment',
    'A#': 'warm brown, sepia, antique parchment',
    B: 'cool white, ice, pale silver-blue',
  };

  const MINOR = {
    C: 'charcoal, graphite, cold moonlight',
    'C#': 'dark violet, nocturne purple',
    Db: 'dark violet, nocturne purple',
    D: 'deep blue, stormy slate, silver',
    Eb: 'smoky teal, dusk cyan',
    'D#': 'smoky teal, dusk cyan',
    E: 'midnight blue, ink, faint cyan highlights',
    F: 'olive green, moss, muted earth',
    'F#': 'indigo, deep ultramarine, starlight',
    Gb: 'indigo, deep ultramarine, starlight',
    G: 'dark amber, burnt sienna, candlelight',
    Ab: 'burgundy, wine red, velvet shadow',
    'G#': 'burgundy, wine red, velvet shadow',
    A: 'cool green, sea glass, pale jade',
    Bb: 'sepia, umber, antique bronze',
    'A#': 'sepia, umber, antique bronze',
    B: 'glacial blue-grey, porcelain shadow',
  };

  const colors = mode === 'minor' ? (MINOR[tonic] || '') : (MAJOR[tonic] || '');
  if (!colors) return '';
  return `dominant colors are ${colors}`;
}

function parseMusicalKey(raw) {
  const s0 = String(raw ?? '').trim();
  if (!s0) return null;
  const s = s0
    .replace(/♭/g, 'b')
    .replace(/♯/g, '#')
    .replace(/major/gi, 'major')
    .replace(/minor/gi, 'minor')
    .replace(/(maj|min)\b/gi, (m) => (m.toLowerCase() === 'maj' ? 'major' : 'minor'))
    .replace(/\s+/g, ' ')
    .trim();

  // Examples:
  // - "D minor" / "D minor key" / "Dm"
  // - "F# major" / "Gb major"
  const m = s.match(/^([A-G])\s*([#b])?\s*(major|minor)?\b/i);
  if (!m) {
    // "Dm" shorthand
    const m2 = s.match(/^([A-G])\s*([#b])?\s*m\b/i);
    if (!m2) return null;
    const tonic = `${m2[1].toUpperCase()}${m2[2] || ''}`;
    return { tonic, mode: 'minor' };
  }

  const tonic = `${m[1].toUpperCase()}${m[2] || ''}`;
  const mode = (m[3] || '').toLowerCase() === 'minor' ? 'minor' : 'major';
  return { tonic, mode };
}

function getArtHistoricalDirection(period) {
  const p = String(period ?? '').trim().toLowerCase();
  if (!p) return '';
  if (p === 'baroque') {
    return 'baroque chiaroscuro, Rembrandt or Caravaggio lighting, dramatic shadows, divine light beams, ornate detail, oil painting';
  }
  if (p === 'classical') {
    return 'neoclassical restraint, balanced geometry, museum-grade composition, timeless elegance, refined symbolism';
  }
  if (p === 'romantic') {
    return 'romantic sublime, Caspar David Friedrich mood, vast landscape metaphor, emotional atmosphere, dramatic sky';
  }
  if (p === 'modern') {
    return 'modern abstract expressionism or minimalism, Rothko-like color fields, emotional resonance through color, quiet intensity';
  }
  return '';
}

function getSynestheticInstrumentationDirection(instrumentation) {
  const list = Array.isArray(instrumentation)
    ? instrumentation
    : typeof instrumentation === 'string'
      ? instrumentation.split(',')
      : [];

  const tokens = list.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  if (!tokens.length) return '';

  const out = [];
  const has = (re) => tokens.some((t) => re.test(t));
  if (has(/piano|keys|keyboard/)) out.push('liquid glass texture, water droplets, polished porcelain reflections');
  if (has(/string|violin|cello|viola|harp/)) out.push('silk threads, flowing lines, continuous ribbons, woven texture');
  if (has(/brass|horn|trumpet|trombone/)) out.push('metallic luster, golden rays, rigid architectural forms');
  if (has(/woodwind|flute|clarinet|oboe|bassoon/)) out.push('airy translucency, reed-like fibers, whispering currents');
  if (has(/choir|voice|vocal/)) out.push('incandescent haze, sacred aura, soft halos, breath-like fog');
  return out.length ? out.join(', ') : '';
}

function abstractifySubject(text) {
  const s0 = String(text ?? '').trim();
  if (!s0) return '';

  // Replace overly literal/modern nouns with metaphorical correlatives for album-cover aesthetics.
  const replacements = [
    { re: /(パソコン|pc|computer|laptop)/gi, to: 'cold glass rectangle glow, geometric light' },
    { re: /(スマホ|スマートフォン|phone|smartphone)/gi, to: 'small illuminated rectangle, distant signal' },
    { re: /(ビル|建物|building|city|都市)/gi, to: 'distant monolith silhouettes, vertical geometry' },
    { re: /(電車|train|駅|station)/gi, to: 'vanishing lines, rhythmic rails, traveling horizon' },
    { re: /(会社|office|会議|meeting)/gi, to: 'grid of windows, fluorescent haze, anonymous corridor' },
    { re: /(SNS|social media|timeline)/gi, to: 'fragmented mirrors, drifting shards of light' },
  ];

  let s = s0;
  for (const r of replacements) s = s.replace(r.re, r.to);

  // Avoid explicit typography requests in subject.
  s = s.replace(/(text|logo|typography|文字|ロゴ)/gi, '').trim();
  return s.slice(0, 220);
}

function objectiveCorrelativeHints(motifTags) {
  const tags = Array.isArray(motifTags) ? motifTags.map((t) => String(t).trim()) : [];
  const has = (w) => tags.includes(w);
  const out = [];
  if (has('孤独')) out.push('objective correlative: vast snowfield, single leafless tree, empty chair');
  if (has('希望')) out.push('objective correlative: dawn light through mist, thin gold horizon');
  if (has('静寂')) out.push('objective correlative: still water surface, minimal ripples, quiet fog');
  if (has('影')) out.push('objective correlative: long shadows, chiaroscuro gradients');
  if (has('記憶')) out.push('objective correlative: faded layers, palimpsest texture, soft fragments');
  return out.length ? out.join(', ') : '';
}

/**
 * P5: Generate reasoning for why this prompt/style was chosen
 * @param {Object} params - Reasoning parameters
 * @param {number} [params.valence] - Valence value
 * @param {number} [params.arousal] - Arousal value
 * @param {number} [params.focus] - Focus value
 * @param {string} [params.stylePreset] - Style preset ID
 * @param {string[]} [params.motifTags=[]] - Artistic motif tags
 * @returns {string} Reasoning explanation
 */
export function generatePromptReasoning(params) {
  const { valence, arousal, focus, stylePreset, motifTags = [] } = params;
  
  const reasons = [];
  
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
 * @param {string} tag - Japanese motif tag
 * @returns {string} English translation
 */
function translateMotifTag(tag) {
  const translations = {
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
 * @returns {Array<{id: string, name: string}>} List of presets
 */
export function getStylePresetsList() {
  return Object.entries(STYLE_PRESETS).map(([id, preset]) => ({
    id,
    name: preset.name,
  }));
}
