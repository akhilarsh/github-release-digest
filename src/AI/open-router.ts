import OpenAI from 'openai';
import { config as dotenvConfig } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { cleanDescription, wrapText } from '../core/format';
import { summarizeWithAnthropic } from './anthropic';
import { logger } from '../utils/logger';
import { getConfig } from '../utils/config';

// Load environment variables
dotenvConfig();

// Initialize OpenAI client only if API key is provided
let openai: OpenAI | null = null;

// Default model configuration
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4';

// Cache for loaded models and instructions
let cachedInstructions: string | null = null;
let cachedFreeModels: string[] | null = null;

/**
 * Load free models from the JSON file with caching
 * @returns string[] - Array of free model names
 * @throws Error if models file cannot be loaded or is invalid
 */
function loadFreeModels(): string[] {
  // Return cached models if available
  if (cachedFreeModels !== null) {
    return cachedFreeModels;
  }

  try {
    const modelsPath = join(__dirname, 'models.json');
    logger.debug(`Loading free models from: ${modelsPath}`);

    const modelsData = readFileSync(modelsPath, 'utf-8');
    const models = JSON.parse(modelsData);

    if (!models.freeModels || !Array.isArray(models.freeModels)) {
      throw new Error('Models file missing or invalid freeModels array');
    }

    // Cache the models
    cachedFreeModels = models.freeModels;
    logger.debug(`Loaded ${cachedFreeModels.length} free models for fallback`);
    return cachedFreeModels;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error loading free models: ${errorMessage}`);
    throw new Error(`Failed to load free models: ${errorMessage}`);
  }
}

/**
 * Get the next model to try based on priority order
 * @param attemptNumber - The current attempt number (0-based)
 * @returns string - The model name to try
 */
function getModelForAttempt(attemptNumber: number): string {
  // Priority 1: From .env
  if (attemptNumber === 0 && process.env.AI_MODEL) {
    logger.debug(`Using model from environment: ${process.env.AI_MODEL}`);
    return process.env.AI_MODEL;
  }

  // Priority 2: Default model
  if (attemptNumber === 0 || (attemptNumber === 1 && !process.env.AI_MODEL)) {
    logger.debug(`Using default model: ${DEFAULT_MODEL}`);
    return DEFAULT_MODEL;
  }

  // Priority 3: Pick one from models.json
  try {
    const freeModels = loadFreeModels();
    const modelIndex = (attemptNumber - (process.env.AI_MODEL ? 2 : 1)) % freeModels.length;
    const selectedModel = freeModels[modelIndex];
    logger.debug(`Using fallback model ${modelIndex + 1}/${freeModels.length}: ${selectedModel}`);
    return selectedModel;
  } catch (error) {
    logger.error(`Failed to load free models, using default: ${DEFAULT_MODEL}`);
    return DEFAULT_MODEL;
  }
}

/**
 * Get the maximum number of attempts based on available models
 * @returns number - Maximum number of attempts
 */
function getMaxAttempts(): number {
  let attempts = 1; // Start with 1 attempt

  // Add 1 if we have a default model different from env
  if (!process.env.AI_MODEL || process.env.AI_MODEL !== DEFAULT_MODEL) {
    attempts++;
  }

  // Add free models count
  try {
    const freeModels = loadFreeModels();
    attempts += freeModels.length;
  } catch (error) {
    logger.warn('Could not load free models, limiting fallback attempts');
  }

  return attempts;
}

// Wrap OpenRouter client init in a function
function initOpenRouterClient(): boolean {
  if (openai) return true;
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    logger.warn('OPENROUTER_API_KEY not found in environment variables');
    return false;
  }
  try {
    openai = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: key });
    const initialModel = getModelForAttempt(0);
    logger.info(`OpenAI client initialized successfully with OpenRouter API using model: ${initialModel}`);
    return true;
  } catch (error) {
    logger.error(`Failed to initialize OpenAI client: ${error instanceof Error ? error.message : 'Unknown error'}`);
    openai = null;
    return false;
  }
}

/**
 * Load instructions from the markdown file with caching
 * @returns string - The instructions template
 * @throws Error if instructions file cannot be loaded or is invalid
 */
function loadInstructions(): string {
  // Return cached instructions if available
  if (cachedInstructions !== null) {
    return cachedInstructions;
  }

  try {
    const instructionsPath = join(__dirname, 'instructions.md');
    logger.debug(`Loading AI instructions from: ${instructionsPath}`);

    const instructions = readFileSync(instructionsPath, 'utf-8');

    // Validate that instructions contain the template variable
    if (!instructions.includes('${text}')) {
      throw new Error('Instructions file missing ${text} template variable');
    }

    // Cache the instructions
    cachedInstructions = instructions;
    logger.debug('AI instructions loaded and cached successfully');
    return instructions;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error loading AI instructions: ${errorMessage}`);
    throw new Error(`Failed to load AI instructions: ${errorMessage}`);
  }
}



/**
 * Create an executive summary of a release description for business stakeholders
 * Uses Anthropic as primary provider with OpenRouter as fallback for any errors
 * @param text - The release description text
 * @returns Promise<string> - The executive summary
 */
export async function summarizeText(text: string): Promise<string> {
  logger.info('Starting AI summarization...');

  // Load instructions with error handling
  let instructions: string;
  try {
    instructions = loadInstructions();
  } catch (error) {
    logger.error(`Failed to load AI instructions: ${error}`);
    return cleanDescription(text);
  }

  const prompt = instructions.replace('${text}', text);

  // Try Anthropic first
  try {
    logger.info('Attempting summarization with Anthropic...');

    // Get the Anthropic model from config
    const config = getConfig();
    const anthropicModel = config.anthropicModel || 'claude-3-5-sonnet-20241022';

    const summary = await summarizeWithAnthropic(prompt, anthropicModel);
    if (summary && summary.trim()) {
      logger.info('AI summarization completed successfully with Anthropic');
      logger.info('------------------------------------------------------');
      return summary;
    }
  } catch (error) {
    logger.error(`Anthropic failed: ${error}`);
  }

  // Fallback to OpenRouter
  try {
    logger.info('Falling back to OpenRouter...');
    if (!openai && !initOpenRouterClient()) {
      return cleanDescription(text);
    }

    const completion = await openai!.chat.completions.create({
      model: getModelForAttempt(0),
      messages: [{ role: 'user', content: prompt }],
    });

    const summary = completion.choices[0].message.content;
    if (summary && summary.trim()) {
      logger.info('AI summarization completed successfully with OpenRouter');
      return summary;
    }
  } catch (error) {
    logger.error(`OpenRouter failed: ${error}`);
  }

  // Both failed, return cleaned text
  logger.warn('All AI providers failed, returning cleaned original text');
  return cleanDescription(text);
}


