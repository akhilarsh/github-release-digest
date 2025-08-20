import { logger } from '../utils/logger';
import { cleanDescription } from '../core/format';

// Minimal Anthropic client via fetch to avoid new deps
// Uses Messages API v1

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
/**
 * Extract original text from AI prompt
 * @param promptText - The full prompt including instructions
 * @returns The original text portion
 */
function extractOriginalText(promptText: string): string {
  const marker = '## RELEASE DESCRIPTION TO SUMMARIZE:\n\n';
  const markerIndex = promptText.indexOf(marker);
  return markerIndex !== -1 ? promptText.substring(markerIndex + marker.length) : promptText;
}

export async function summarizeWithAnthropic(text: string, model: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    logger.warn('ANTHROPIC_API_KEY not provided - skipping Anthropic summarization');
    return cleanDescription(extractOriginalText(text));
  }

  const prompt = text;

  const body = {
    model,
    max_tokens: 500,
    messages: [
      { role: 'user', content: prompt },
    ],
  } as const;

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${errText}`);
    }

    const data: any = await response.json();
    const content = Array.isArray(data.content) && data.content.length > 0
      ? (data.content[0].text ?? '')
      : '';

    if (!content) {
      logger.warn('Anthropic returned empty content; using original text');
      return cleanDescription(extractOriginalText(text));
    }

    return content;
  } catch (error) {
    logger.error(`Anthropic summarization failed: ${error}`);
    return cleanDescription(extractOriginalText(text));
  }
}


