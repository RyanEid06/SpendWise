import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import fs from 'fs';

const app = express();
const port = 3000;

// Parse JSON bodies up to 25MB for image uploads
app.use(express.json({ limit: '25mb' }));

// Initialize GoogleGenAI SDK
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Route 1: Analyze spending with Gemini
app.post('/api/gemini/analyze', async (req: Request, res: Response) => {
  try {
    const { prompt, monthKey } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API key is not configured in the AI Studio Secrets panel.',
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
        systemInstruction:
          'You are an objective financial analytics assistant. Distinguish between unusual expenses and inherently bad expenses. Provide constructive, non-judgmental spending insights.',
      },
    });

    const responseText = response.text;
    if (!responseText) {
      return res.status(500).json({ error: 'Empty response from Gemini' });
    }

    try {
      const parsed = JSON.parse(responseText);
      return res.json({
        timestamp: Date.now(),
        analyzedMonthKey: monthKey || '',
        isAiGenerated: true,
        spendingOverview: parsed.spendingOverview || 'Spending analysis complete.',
        historyContext: parsed.historyContext || '',
        biggestChanges: parsed.biggestChanges || [],
        unusualExpenses: parsed.unusualExpenses || [],
        recurringSpending: parsed.recurringSpending || [],
        areasToReview: parsed.areasToReview || [],
      });
    } catch {
      return res.status(500).json({ error: 'Failed to parse Gemini response as JSON' });
    }
  } catch (error: any) {
    console.error('Error analyzing spending:', error);
    return res.status(500).json({
      error: error.message || 'Gemini API call failed',
    });
  }
});

// Route 2: Explain statistical spending trends with Gemini
app.post('/api/gemini/explain-trends', async (req: Request, res: Response) => {
  try {
    const { prompt, periodLabel } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API key is not configured in the AI Studio Secrets panel.',
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
        systemInstruction:
          'You are a precise personal financial advisor explaining real user spending trends. You must ONLY reference the exact numbers given in the prompt, never hallucinate or invent numbers.',
      },
    });

    const responseText = response.text;
    if (!responseText) {
      return res.status(500).json({ error: 'Empty response from Gemini' });
    }

    try {
      const parsed = JSON.parse(responseText);
      return res.json({
        timestamp: Date.now(),
        periodLabel: periodLabel || 'Selected Period',
        summary: parsed.summary || 'Trend analysis complete.',
        keyObservations: Array.isArray(parsed.keyObservations) ? parsed.keyObservations : [],
        categoryHighlights: Array.isArray(parsed.categoryHighlights) ? parsed.categoryHighlights : [],
        recommendation: parsed.recommendation || '',
        isAiGenerated: true,
      });
    } catch {
      return res.status(500).json({ error: 'Failed to parse trend response as JSON' });
    }
  } catch (error: any) {
    console.error('Error explaining trends:', error);
    return res.status(500).json({
      error: error.message || 'Gemini trend explanation failed',
    });
  }
});

// Route 2: Receipt OCR scanning with Gemini
app.post('/api/gemini/scan-receipt', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Image base64 data is required' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API key is not configured in the AI Studio Secrets panel.',
      });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

    const prompt = `Analyze this receipt image and extract the key details in pure JSON:
- merchant: store or business name (string or null if unreadable)
- totalAmount: final total amount paid as a positive number (number or null if not found)
- date: transaction date formatted as YYYY-MM-DD (string or null if not found)
- category: best matching category from this list: [Food, Groceries, Transportation, Shopping, Entertainment, Bills, Subscriptions, Health, Education, Electronics, Travel, Other]
- items: list of item strings with item name and price (e.g. "Milk 2L - 3.50")
- uncertaintyReason: string explaining any uncertainties (e.g. "Total missing", "Blurry text", "Date cut off"), or null if clear.

IMPORTANT: If a value cannot be confidently read from the image, leave it null. Do not invent or hallucinate values.
Output pure JSON matching:
{
  "merchant": "...",
  "totalAmount": 12.34,
  "date": "2026-09-26",
  "category": "...",
  "items": ["..."],
  "uncertaintyReason": null
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType,
              data: cleanBase64,
            },
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const responseText = response.text;
    if (!responseText) {
      return res.status(500).json({ error: 'No text extracted from receipt' });
    }

    try {
      const parsed = JSON.parse(responseText);
      const itemsList = Array.isArray(parsed.items) ? parsed.items : [];
      const notesSummary = itemsList.length > 0 ? `Items: ${itemsList.join('; ')}` : null;

      let dateMillis: number | null = null;
      let dateFormatted: string | null = null;
      if (parsed.date) {
        try {
          const d = new Date(parsed.date);
          if (!isNaN(d.getTime())) {
            dateMillis = d.getTime();
            dateFormatted = d.toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            });
          }
        } catch {}
      }

      return res.json({
        merchant: parsed.merchant || null,
        totalAmount: typeof parsed.totalAmount === 'number' ? parsed.totalAmount : null,
        dateMillis,
        dateFormatted,
        category: parsed.category || null,
        items: itemsList,
        notesSummary,
        isUncertain: !parsed.totalAmount || !parsed.merchant || !!parsed.uncertaintyReason,
        uncertaintyReason: parsed.uncertaintyReason || null,
      });
    } catch {
      return res.status(500).json({ error: 'Failed to parse receipt scanner response as JSON' });
    }
  } catch (error: any) {
    console.error('Error scanning receipt:', error);
    return res.status(500).json({
      error: error.message || 'Receipt OCR failed',
    });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.resolve(process.cwd(), 'dist');

  if (isProd && fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    // In dev mode, mount Vite middleware
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: 3000 },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`SpendWise server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
