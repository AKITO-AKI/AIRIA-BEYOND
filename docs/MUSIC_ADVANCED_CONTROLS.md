# Advanced music generation controls

`POST /api/music/generate`

The API supports the baseline emotional inputs, plus optional advanced controls for more originality and classical structure.

## Baseline
- `valence` (-1..1)
- `arousal` (0..1)
- `focus` (0..1)
- `confidence` (0..1)
- `duration` (seconds)
- `motif_tags` (array)
- `seed` (number)

## Advanced (optional)
- `key`: global key, e.g. `"C major"`, `"d minor"`
- `tempo`: BPM (40..220)
- `timeSignature`: `"3/4" | "4/4" | "6/8"`
- `form`: `"sonata" | "rondo" | "ABA" | "theme-variation" | "minuet-trio"` (others will be treated as hints)
- `period`: `"baroque" | "classical" | "romantic" | "modern"`
- `instrumentation`: string array hint, e.g. `["piano", "strings"]`
- `emotional_arc`: optional object (from event refine), used to shape section energy and resolution
- `humanize`: optional object to override performance shaping
	- `rubato`: `"none" | "subtle" | "expressive"`
	- `velocityCurve`: `"flat" | "phrase"`
	- `peakBoost`: number (0..0.6)
	- `phraseEndSoftness`: number (0..0.8)
- `motif_seed`: degree array seed (1..14), e.g. `[1,3,5,3,2,1]`
- `rhythm_seed`: rhythm seed in beats (snapped to {0.25,0.5,1,2,4}), e.g. `[0.5,0.5,1,1,2]`
- `section_plan`: optional object (reserved for custom planning). If provided, the service still validates/sanitizes to MIDI-safe constraints.

## Artistic depth (optional output fields)
- `leitmotifs`: keyword-tagged motifs (degrees+rhythm) to support leitmotif writing
- `humanize`: MIDI-friendly performance guidance (`rubato`, velocity curve parameters)
- `sections[].cadence`: now supports `PICARDY` (minor-key redemption cadence)
- `sections[].harmonicFunctions`: optional tags aligned to chordProgression: `tension|release|ambiguity`

## What these controls do
- Builds a classical section plan (form + keys + cadence goals)
- Applies strong cadences (PAC/HC/DC) at section endings
- Supports a Picardy-third cadence when requested (`PICARDY`)
- Uses per-section keys for modulation (supported keys only)
- Uses motif seeds and systematic development (sequence, inversion, augmentation/diminution)
