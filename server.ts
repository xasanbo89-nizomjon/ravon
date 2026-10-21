import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import app, { 
  getGeminiClient, 
  DEFAULT_TELEGRAM_BOT_TOKEN, 
  DEFAULT_TELEGRAM_ADMIN_CHAT_ID 
} from './server/app.js';
import { 
  startTelegramBotPolling, 
  getCleanAppUrl 
} from './server/botService.js';

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = parseInt(process.env.PORT || '3000', 10);

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT} (${isProd ? 'production' : 'development'})`);

    const botToken = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_TELEGRAM_BOT_TOKEN;
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || DEFAULT_TELEGRAM_ADMIN_CHAT_ID;
    const appUrl = getCleanAppUrl();

    if (botToken) {
      try {
        startTelegramBotPolling({
          botToken,
          adminChatId,
          appUrl,
          getGeminiClient,
        });
      } catch (err) {
        console.warn('[Server] Bot polling startup warning:', err);
      }
    }
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
});

export default app;
