import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn('[Gemini] GEMINI_API_KEY not set');
}

export const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export const geminiFlash = genAI?.getGenerativeModel({
  model: 'gemini-2.5-flash-lite',
  generationConfig: {
    temperature: 0.3,
    maxOutputTokens: 2048,
  },
});

export async function geminiGenerate(prompt: string, systemPrompt?: string): Promise<string> {
  if (!geminiFlash) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  try {
    const fullPrompt = systemPrompt
      ? `${systemPrompt}\n\n${prompt}`
      : prompt;
    const result = await geminiFlash.generateContent(fullPrompt);
    const response = await result.response;
    return response.text();
  } catch (e: any) {
    console.error('[Gemini] Error:', e.message);
    throw e;
  }
}

export async function geminiStream(
  prompt: string,
  systemPrompt?: string,
  onChunk?: (text: string) => void
): Promise<string> {
  if (!geminiFlash) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  try {
    const fullPrompt = systemPrompt
      ? `${systemPrompt}\n\n${prompt}`
      : prompt;
    const result = await geminiFlash.generateContentStream(fullPrompt);
    let fullText = '';
    for await (const chunk of result.stream) {
      const text = chunk.text();
      fullText += text;
      if (onChunk) onChunk(text);
    }
    return fullText;
  } catch (e: any) {
    console.error('[Gemini] Stream error:', e.message);
    throw e;
  }
}
