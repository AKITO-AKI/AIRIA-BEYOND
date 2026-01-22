/**
 * Type definitions for Prototype P2: LLM-based analysis
 * Intermediate Representation (IR) and related types
 */

import { z } from 'zod';

/**
 * Zod schema for IR validation
 */
export const IntermediateRepresentationSchema = z.object({
  valence: z.number().min(-1).max(1),
  arousal: z.number().min(0).max(1),
  focus: z.number().min(0).max(1),
  motif_tags: z.array(z.string()).min(3).max(5),
  confidence: z.number().min(0).max(1),
  classical_profile: z
    .object({
      tempo: z.string().optional(),
      dynamics: z.string().optional(),
      harmony: z.string().optional(),
    })
    .optional(),
  reasoning: z.string().optional(), // P5: reasoning for causal logging
});

/**
 * @typedef {Object} SessionInput
 * @property {string} mood
 * @property {number} duration
 * @property {Object} [onboardingData]
 * @property {string} [onboardingData.emotionalProfile]
 * @property {Record<string, any>} [onboardingData.preferences]
 * @property {string} [freeText]
 * @property {string} timestamp
 */

/**
 * @typedef {Object} IntermediateRepresentation
 * @property {number} valence - -1.0 to +1.0 (negative=unpleasant, positive=pleasant)
 * @property {number} arousal - 0.0 to 1.0 (low=calm, high=excited)
 * @property {number} focus - 0.0 to 1.0 (attention/concentration level)
 * @property {string[]} motif_tags - classical/artistic vocabulary, 3-5 tags
 * @property {number} confidence - 0.0 to 1.0 (how confident the analysis is)
 * @property {Object} [classical_profile]
 * @property {string} [classical_profile.tempo]
 * @property {string} [classical_profile.dynamics]
 * @property {string} [classical_profile.harmony]
 * @property {string} [reasoning] - LLM's explanation of why these values were chosen
 */

/**
 * @typedef {Object} MusicMotif
 * @property {number[]} degrees - scale degrees, e.g., [1, 3, 5, 3]
 * @property {number[]} rhythm - durations in beats, e.g., [0.5, 0.5, 1, 1]
 */

/**
 * @typedef {Object} MusicSection
 * @property {string} name - e.g., "A", "B"
 * @property {number} measures
 * @property {string[]} chordProgression - Roman numeral analysis, e.g., ["i", "iv", "V", "i"]
 * @property {Object} melody
 * @property {MusicMotif[]} melody.motifs
 * @property {string} dynamics - pp, p, mp, mf, f, ff
 * @property {string} texture - simple, contrapuntal, homophonic
 */

/**
 * @typedef {Object} MusicStructure
 * @property {string} key - e.g., "d minor"
 * @property {number} tempo - BPM
 * @property {string} timeSignature - e.g., "3/4"
 * @property {string} form - e.g., "ABA", "theme-variation", "rondo"
 * @property {MusicSection[]} sections
 * @property {string} instrumentation - e.g., "piano"
 * @property {string} character - e.g., "melancholic and introspective"
 * @property {string} [reasoning] - LLM's explanation of musical choices
 */
