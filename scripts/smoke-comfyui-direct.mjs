import {
  buildBasicComfyWorkflow,
  comfyuiSubmitPrompt,
  comfyuiWaitForImage,
  comfyuiFetchImageBytes,
  bytesToDataUrl,
} from '../api/lib/comfyuiClient.js';

function preview(s, n = 140) {
  const t = String(s || '');
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

async function main() {
  const prompt = process.env.SMOKE_PROMPT || 'abstract watercolor album cover, soft light, minimal, tranquil';
  const negative = process.env.SMOKE_NEGATIVE || 'text, watermark, logo, low quality, blurry';

  const workflow = buildBasicComfyWorkflow({
    prompt,
    negativePrompt: negative,
    seed: process.env.SMOKE_SEED ? Number(process.env.SMOKE_SEED) : 12345,
    width: Number(process.env.COMFYUI_WIDTH || 1024),
    height: Number(process.env.COMFYUI_HEIGHT || 1024),
    steps: Number(process.env.COMFYUI_STEPS || 25),
    cfg: Number(process.env.COMFYUI_CFG || 7.5),
    sampler_name: process.env.COMFYUI_SAMPLER || 'euler',
    scheduler: process.env.COMFYUI_SCHEDULER || 'normal',
    ckpt_name: process.env.COMFYUI_CHECKPOINT,
    filenamePrefix: 'AIRIA_SMOKE',
  });

  console.log('[smoke] ComfyUI direct /prompt', {
    baseUrl: process.env.COMFYUI_BASE_URL || 'http://127.0.0.1:8188',
    prompt: preview(prompt),
    negative: preview(negative),
  });

  const promptId = await comfyuiSubmitPrompt({
    workflow,
    clientId: 'airia_smoke',
    debugTag: 'ComfyUI_SMOKE',
  });

  console.log('[smoke] promptId:', promptId);

  const { ref } = await comfyuiWaitForImage({
    promptId,
    debugTag: 'ComfyUI_SMOKE',
  });

  console.log('[smoke] image ref:', ref);

  const { bytes, contentType } = await comfyuiFetchImageBytes(ref);
  const dataUrl = bytesToDataUrl(bytes, contentType);

  console.log('[smoke] OK:', {
    contentType,
    bytes: bytes.length,
    dataUrlPreview: preview(dataUrl, 80),
  });
}

main().catch((e) => {
  const code = e?.cause?.code || e?.code;
  if (code === 'ECONNREFUSED') {
    console.error('[smoke] ComfyUI is not reachable. Start ComfyUI first (default: http://127.0.0.1:8188)');
    console.error('[smoke] Tip: set COMFYUI_BASE_URL if you changed the port/host.');
  }
  console.error('[smoke] fatal:', e);
  process.exit(1);
});
