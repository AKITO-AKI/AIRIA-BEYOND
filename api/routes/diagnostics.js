import express from 'express';
import { getImageDiagnostics } from '../controllers/diagnostics.js';
import { getAuthStorePath } from '../authStore.js';

const router = express.Router();

router.get('/image', getImageDiagnostics);

router.get('/version', (req, res) => {
	const commit = String(process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || '').trim();
	const service = String(process.env.RENDER_SERVICE_NAME || process.env.SERVICE_NAME || '').trim();
	const instance = String(process.env.RENDER_INSTANCE_ID || '').trim();
	return res.json({
		now: new Date().toISOString(),
		nodeEnv: String(process.env.NODE_ENV || '').trim() || 'production',
		service: service || undefined,
		instance: instance || undefined,
		commit: commit || undefined,
		authStorePath: getAuthStorePath(),
	});
});

export default router;
