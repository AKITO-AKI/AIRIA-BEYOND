import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
const allowedOrigins = [
  'https://akito-aki.github.io',
  'http://localhost:5173',
  'http://localhost:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'production',
    services: {
      replicate: { 
        available: !!process.env.REPLICATE_API_TOKEN,
        configured: !!process.env.REPLICATE_API_TOKEN
      },
      openai: { 
        available: !!process.env.OPENAI_API_KEY,
        configured: !!process.env.OPENAI_API_KEY
      }
    }
  });
});

// Import and mount API routes
import analyzeRoutes from './api/routes/analyze.js';
import imageRoutes from './api/routes/image.js';
import musicRoutes from './api/routes/music.js';
import jobRoutes from './api/routes/job.js';
import adminRoutes from './api/routes/admin.js';

app.use('/api/analyze', analyzeRoutes);
app.use('/api/image', imageRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/job', jobRoutes);
app.use('/api/admin', adminRoutes);

// Sitemap
app.get('/sitemap.xml', (req, res) => {
  const baseUrl = 'https://akito-aki.github.io/AIRIA-BEYOND';
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/terms</loc>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${baseUrl}/privacy</loc>
    <priority>0.5</priority>
  </url>
</urlset>`;
  
  res.header('Content-Type', 'application/xml');
  res.send(sitemap);
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`🚀 AIRIA BEYOND API server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'production'}`);
});
