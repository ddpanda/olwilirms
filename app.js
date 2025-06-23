import express from 'express';
import puppeteer from 'puppeteer';

const app = express();
app.use(express.json());

app.post('/', async (req, res) => {
  const { id, site } = req.body;

  if (!id || !site) {
    return res.status(400).json({ error: 'Missing required parameters: id and site' });
  }

  const videoUrl = `https://player.vimeo.com/video/${id}`;
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const blocked = ['image', 'stylesheet', 'font', 'media'];
      if (blocked.includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    await page.setExtraHTTPHeaders({
      Referer: site,
      Origin: site,
    });

    await page.goto(videoUrl, { waitUntil: 'networkidle2', timeout: 20000 });

    const playerConfig = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const script of scripts) {
        const content = script.textContent || '';
        const match = content.match(/window\.playerConfig\s*=\s*(\{[\s\S]*\})/);
        if (match) {
          try {
            let jsonString = match[1].trim().replace(/;?\s*$/, '');
            const open = (jsonString.match(/\{/g) || []).length;
            const close = (jsonString.match(/\}/g) || []).length;
            if (close > open) {
              jsonString = jsonString.slice(0, jsonString.lastIndexOf('}'));
            }
            return JSON.parse(jsonString);
          } catch {
            return null;
          }
        }
      }
      return null;
    });

    await browser.close();

    if (!playerConfig) {
      return res.status(500).json({ error: 'Failed to extract playerConfig' });
    }

    const json_url = playerConfig?.request?.files?.dash?.cdns?.akfire_interconnect_quic?.avc_url || null;
    const text_tracks = playerConfig?.request?.text_tracks || [];
    const title = playerConfig?.video?.title || 'Untitled';
    const thumbnail_url = playerConfig?.video?.thumbnail_url || 'https://placehold.co/1280x720?text=No+Thumbnail';

    return res.json({
      json_url,
      text_tracks,
      title,
      thumbnail_url,
    });
  } catch (err) {
    if (browser) await browser.close();
    console.error('Error during Puppeteer execution:', err);
    return res.status(500).json({ error: 'Server error while processing video' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
