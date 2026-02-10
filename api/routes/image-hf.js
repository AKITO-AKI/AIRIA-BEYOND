import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

const HF_API_KEY = process.env.HF_API_KEY;
const HF_MODEL_URL = 'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2';

router.post('/generate', async (req, res) => {
  const prompt = req.body.prompt;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });
  if (!HF_API_KEY) return res.status(500).json({ error: 'HF_API_KEY not set' });

  try {
    const response = await fetch(HF_MODEL_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${HF_API_KEY}` },
      body: JSON.stringify({ inputs: prompt })
    });
    if (!response.ok) {
      const err = await response.text();
      return res.status(502).json({ error: 'Hugging Face API error', details: err });
    }
    const buffer = await response.arrayBuffer();
    res.type('png').send(Buffer.from(buffer));
  } catch (e) {
    res.status(500).json({ error: 'Internal error', details: e.message });
  }
});

export default router;
