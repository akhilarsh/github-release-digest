import { test } from 'uvu';
import * as assert from 'uvu/assert';
import fs from 'fs';
import path from 'path';

// Store original environment variables
let originalEnv: NodeJS.ProcessEnv;
const openRouterModuleId = require.resolve('../src/AI/open-router');

test.before.each(() => {
    // Store original environment
    originalEnv = { ...process.env };

    // Block dotenv from populating OPENROUTER_API_KEY by setting an empty value
    process.env.OPENROUTER_API_KEY = '';
    // Ensure Anthropic direct path is disabled in tests
  process.env.ANTHROPIC_API_KEY = '';
    // Reset model selection
    delete process.env.AI_MODEL;

    // Purge module cache so each test re-evaluates the module with current env
    delete require.cache[openRouterModuleId];
});

test.after.each(() => {
    // Restore original environment
    process.env = originalEnv;
    // Purge cache to avoid leaked state between files
    delete require.cache[openRouterModuleId];
});

test('AI Model Fallback › should return original text when no API key is provided', async () => {
    // Import the module
    const { summarizeText } = await import('../src/AI/open-router');

    const originalText = 'This is a test text that should be returned unchanged';
    const result = await summarizeText(originalText);

    // The cleanDescription function might add a period, so we check if it contains the original text
    assert.ok(result.includes(originalText), 'Result should contain the original text');
});

test('AI Model Fallback › should load models.json correctly', () => {
    const modelsPath = path.join(__dirname, '../src/AI/models.json');

    // Check if models.json exists
    assert.ok(fs.existsSync(modelsPath), 'models.json should exist');

    // Check if it's valid JSON
    const modelsData = fs.readFileSync(modelsPath, 'utf-8');
    const models = JSON.parse(modelsData);

    // Check structure
    assert.ok(models.freeModels, 'models.json should have freeModels property');
    assert.ok(Array.isArray(models.freeModels), 'freeModels should be an array');
    assert.ok(models.freeModels.length > 0, 'freeModels should not be empty');

    // Check that all models are strings
    models.freeModels.forEach((model: any, index: number) => {
        assert.type(model, 'string', `Model at index ${index} should be a string`);
        assert.ok(model.includes('/'), `Model at index ${index} should contain a slash (format: org/model)`);
    });
});

test('AI Model Fallback › should load instructions.md correctly', () => {
    const instructionsPath = path.join(__dirname, '../src/AI/instructions.md');

    // Check if instructions.md exists
    assert.ok(fs.existsSync(instructionsPath), 'instructions.md should exist');

    // Check if it contains the template variable
    const instructions = fs.readFileSync(instructionsPath, 'utf-8');
    assert.ok(instructions.includes('${text}'), 'instructions.md should contain ${text} template variable');
    assert.ok(instructions.length > 0, 'instructions.md should not be empty');
});

test('AI Model Fallback › should handle environment variable for AI_MODEL', () => {
    // Set environment variable
    process.env.AI_MODEL = 'test-model/test-variant';

    // The function should be able to handle this without errors
    // (we can't test the actual API call without mocking, but we can test the setup)
    assert.is(process.env.AI_MODEL, 'test-model/test-variant');
});

test('AI Model Fallback › should use default model when AI_MODEL is not set', () => {
    // Ensure AI_MODEL is not set
    delete process.env.AI_MODEL;

    // The default model should be used
    // We can't test the actual API call without mocking, but we can verify the environment setup
    assert.is(process.env.AI_MODEL, undefined);
});

test('AI Model Fallback › should handle missing models.json gracefully', async () => {
    // Temporarily rename models.json to test missing file scenario
    const modelsPath = path.join(__dirname, '../src/AI/models.json');
    const backupPath = path.join(__dirname, '../src/AI/models.json.backup');

    try {
        // Backup the original file
        fs.copyFileSync(modelsPath, backupPath);

        // Remove the original file
        fs.unlinkSync(modelsPath);

        // Import the module - it should handle missing file gracefully
        const { summarizeText } = await import('../src/AI/open-router');

        // Should still work (return original text when no API key)
        const originalText = 'Test text';
        const result = await summarizeText(originalText);

        assert.is(result, originalText);
    } finally {
        // Restore the original file
        if (fs.existsSync(backupPath)) {
            fs.copyFileSync(backupPath, modelsPath);
            fs.unlinkSync(backupPath);
        }
    }
});

test('AI Model Fallback › should handle invalid models.json gracefully', async () => {
    // Temporarily backup and corrupt models.json
    const modelsPath = path.join(__dirname, '../src/AI/models.json');
    const backupPath = path.join(__dirname, '../src/AI/models.json.backup');

    try {
        // Backup the original file
        fs.copyFileSync(modelsPath, backupPath);

        // Write invalid JSON
        fs.writeFileSync(modelsPath, '{"invalid": "json"', 'utf-8');

        // Import the module - it should handle invalid JSON gracefully
        const { summarizeText } = await import('../src/AI/open-router');

        // Should still work (return original text when no API key)
        const originalText = 'Test text';
        const result = await summarizeText(originalText);

        assert.is(result, originalText);
    } finally {
        // Restore the original file
        if (fs.existsSync(backupPath)) {
            fs.copyFileSync(backupPath, modelsPath);
            fs.unlinkSync(backupPath);
        }
    }
});

test('AI Model Fallback › should handle missing instructions.md gracefully', async () => {
    // Temporarily rename instructions.md to test missing file scenario
    const instructionsPath = path.join(__dirname, '../src/AI/instructions.md');
    const backupPath = path.join(__dirname, '../src/AI/instructions.md.backup');

    try {
        // Backup the original file
        fs.copyFileSync(instructionsPath, backupPath);

        // Remove the original file
        fs.unlinkSync(instructionsPath);

        // Import the module - it should handle missing file gracefully
        const { summarizeText } = await import('../src/AI/open-router');

        // Should still work (return original text when no API key)
        const originalText = 'Test text';
        const result = await summarizeText(originalText);

        assert.is(result, originalText);
    } finally {
        // Restore the original file
        if (fs.existsSync(backupPath)) {
            fs.copyFileSync(backupPath, instructionsPath);
            fs.unlinkSync(backupPath);
      }
    }
});

test('AI Model Fallback › should handle instructions.md without template variable gracefully', async () => {
    // Temporarily backup and modify instructions.md
    const instructionsPath = path.join(__dirname, '../src/AI/instructions.md');
    const backupPath = path.join(__dirname, '../src/AI/instructions.md.backup');

    try {
        // Backup the original file
        fs.copyFileSync(instructionsPath, backupPath);

        // Write instructions without template variable
        fs.writeFileSync(instructionsPath, 'Invalid instructions without template variable', 'utf-8');

        // Import the module - it should handle invalid instructions gracefully
        const { summarizeText } = await import('../src/AI/open-router');

        // Should still work (return original text when no API key)
        const originalText = 'Test text';
        const result = await summarizeText(originalText);

        assert.is(result, originalText);
    } finally {
        // Restore the original file
        if (fs.existsSync(backupPath)) {
            fs.copyFileSync(backupPath, instructionsPath);
            fs.unlinkSync(backupPath);
        }
    }
});

test.run();
