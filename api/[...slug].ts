import serverless from 'serverless-http';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initAppForServerless } from '../server/index';

let handler: any = null;
let initPromise: Promise<any> | null = null;

async function ensureHandler() {
  if (!handler) {
    if (!initPromise) {
      initPromise = (async () => {
        console.log("🔄 Initializing serverless handler...");
        try {
          const app = await initAppForServerless();
          console.log("✅ App initialized, wrapping with serverless-http");
          handler = serverless(app);
          console.log("✅ Handler ready");
          return handler;
        } catch (err) {
          console.error("❌ Failed to initialize handler:", err);
          throw err;
        }
      })();
    }
    await initPromise;
  }
  return handler;
}

export default async function (req: VercelRequest, res: VercelResponse) {
  try {
    console.log(`📥 ${req.method} ${req.url}`);
    const h = await ensureHandler();
    return h(req, res);
  } catch (err) {
    console.error("❌ Handler error:", err);
    return res.status(500).json({ 
      error: "Internal Server Error",
      message: err instanceof Error ? err.message : "Unknown error"
    });
  }
}
