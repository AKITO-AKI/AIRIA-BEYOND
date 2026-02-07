# Fine-tuning (FT) notes for AIRIA-BEYOND

This project currently improves output quality primarily via **structured prompting + strict JSON sanitization + rule-based fallback**.

If you still want Fine-tuning (FT), here are the practical constraints and a safe path.

## Can an FT model be used by other users?

Yes, but typically **not directly**.

- Fine-tuned models (e.g., OpenAI FT) live under *your* provider account/org.
- End users do **not** get to call your FT model unless you give them your provider API key (not recommended).
- The common pattern is: **your backend calls the FT model** and returns results to users.

So: FT can benefit *all* your product users, as long as the calls are made server-side.

## What is safe to fine-tune on?

Avoid training on copyrighted works you don't have rights to.

Recommended datasets:
- Your own generated / composed MIDI or symbolic data (with rights you own)
- Public domain classical material (scores that are clearly public domain in your jurisdiction)
- Licensed datasets with clear redistribution/training rights

Avoid:
- Commercial recordings or copyrighted scores without explicit permission

## What FT helps with in this project

FT is most useful for **format compliance and consistent structure**:
- Always producing valid JSON
- Following your schema exactly
- Keeping section planning consistent (cadence tags, local keys, etc.)

FT is less reliable as a silver bullet for "musical genius".
For musicality, you still want:
- Better structure constraints (forms, cadences, phrase plans)
- Better post-processing rules
- Optional retrieval/examples (few-shot) for specific styles

## Suggested FT approach (practical)

1) Decide the target model/provider
- If using OpenAI: pick a model that supports fine-tuning.

2) Build a training set focused on *inputs → structured outputs*
- Input: your request object + your desired section plan
- Output: a valid `MusicStructure` JSON

3) Validate automatically
- Schema validation
- Additional checks (cadences, allowed keys, allowed chords)

4) Roll out behind the server
- Add an ENV switch to choose FT model vs base model
- Keep the rule-based fallback path

## A non-FT alternative that is often simpler

Before FT, try "few-shot + retrieval":
- Store a small library of high-quality, hand-curated `MusicStructure` examples (public domain-inspired or self-made)
- Pick 1–3 examples based on requested form/period/valence
- Provide them as examples in the prompt

This keeps the system flexible and reduces long-term maintenance.
