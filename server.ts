import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // 1. API: Proxy Image Endpoint
  // This allows the server to fetch images that might have CORS or hotlink protection
  app.get("/api/proxy-image", async (req, res) => {
    const targetUrl = req.query.url as string;
    
    if (!targetUrl) {
      return res.status(400).send("URL parameter is required");
    }

    try {
      console.log(`[Proxy] Requesting: ${targetUrl}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Referer': targetUrl.includes('postimg.') || targetUrl.includes('postimage.') ? 'https://postimages.org/' : 'https://www.google.com/'
        },
        redirect: 'follow',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log(`[Proxy] Upstream status: ${response.status} (${response.statusText})`);
      const contentType = response.headers.get("content-type") || "";
      console.log(`[Proxy] Content-Type: ${contentType}`);

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[Proxy Error] Upstream failed with ${response.status}. Body Preview: ${errorBody.slice(0, 200)}`);
        return res.status(response.status).send(`Upstream failed: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      console.log(`[Proxy] Payload size: ${buffer.length} bytes`);

      // If it's too small, it's probably not a real image but a placeholder or error
      if (buffer.length < 500 && !contentType.includes("svg")) {
        console.warn(`[Proxy Warning] Very small payload (${buffer.length} bytes). Might not be a valid image.`);
      }

      if (contentType) res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=3600"); 

      res.send(buffer);
    } catch (error) {
      console.error(`[Proxy Exception] ${targetUrl}:`, error);
      res.status(500).send("Internal Server Error during proxying");
    }
  });

  // 2. Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
