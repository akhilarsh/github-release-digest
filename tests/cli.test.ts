import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { displayHelp, parseCliArguments, applyCliOverrides, processCli, CliConfig } from '../src/utils/cli';

// Mock console and process for testing
let mockConsole: any = {};
let mockProcess: any = {};
let originalConsole: any = {};
let originalProcess: any = {};

test.before.each(() => {
  // Reset mocks
  mockConsole = {
    log: { called: false, args: [] },
    error: { called: false, args: [] }
  };

  // Store original functions
  originalConsole = {
    log: console.log,
    error: console.error
  };

  originalProcess = {
    argv: process.argv,
    env: { ...process.env },
    exit: process.exit
  };

  // Mock console methods
  console.log = (...args: any[]) => {
    mockConsole.log.called = true;
    mockConsole.log.args.push(args);
  };

  console.error = (...args: any[]) => {
    mockConsole.error.called = true;
    mockConsole.error.args.push(args);
  };

  // Mock process.exit to prevent test runner from exiting
  process.exit = ((code?: number) => {
    throw new Error(`process.exit(${code})`);
  }) as any;

  // Initialize logger for tests
  const { logger } = require('../src/utils/logger');
  logger.updateContext('test');
});

test.after.each(() => {
  // Restore original functions
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  process.argv = originalProcess.argv;

  // Restore environment variables properly
  for (const key in process.env) {
    if (!(key in originalProcess.env)) {
      delete process.env[key];
    }
  }
  for (const key in originalProcess.env) {
    process.env[key] = originalProcess.env[key];
  }

  process.exit = originalProcess.exit;
});

test('displayHelp › should output help information', () => {
  displayHelp();

  assert.ok(mockConsole.log.called);
  const helpOutput = mockConsole.log.args[0][0];

  assert.type(helpOutput, 'string');
  assert.ok(helpOutput.includes('GitHub Release Summary CLI'));
  assert.ok(helpOutput.includes('Usage:'));
  assert.ok(helpOutput.includes('Examples:'));
  assert.ok(helpOutput.includes('--date'));
  assert.ok(helpOutput.includes('--hours'));
  assert.ok(helpOutput.includes('--help'));
});

test('parseCliArguments › should return empty config when no arguments', () => {
  process.argv = ['node', 'script.js'];

  const result = parseCliArguments();

  assert.equal(result, {});
});

test('parseCliArguments › should parse help argument', () => {
  process.argv = ['node', 'script.js', '--help'];

  const result = parseCliArguments();

  assert.equal(result.showHelp, true);
});

test('parseCliArguments › should parse short help argument', () => {
  process.argv = ['node', 'script.js', '-h'];

  const result = parseCliArguments();

  assert.equal(result.showHelp, true);
});

test('parseCliArguments › should parse date argument with specific date', () => {
  process.argv = ['node', 'script.js', '--date', '2023-07-14'];

  const result = parseCliArguments();

  assert.equal(result.timeframe?.type, 'date');
  assert.ok(result.timeframe?.value instanceof Date);
});

test('parseCliArguments › should parse date argument with "today"', () => {
  process.argv = ['node', 'script.js', '--date', 'today'];

  const result = parseCliArguments();
  const today = new Date().toISOString().split('T')[0];

  assert.equal(result.timeframe?.type, 'date');
  assert.ok(result.timeframe?.value instanceof Date);
});

test('parseCliArguments › should parse date argument with "yesterday"', () => {
  process.argv = ['node', 'script.js', '--date', 'yesterday'];

  const result = parseCliArguments();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const expectedYesterday = yesterday.toISOString().split('T')[0];

  assert.equal(result.timeframe?.type, 'date');
  assert.ok(result.timeframe?.value instanceof Date);
});

test('parseCliArguments › should parse hours argument', () => {
  process.argv = ['node', 'script.js', '--hours', '24'];

  const result = parseCliArguments();

  assert.equal(result.timeframe?.type, 'hours');
  assert.equal(result.timeframe?.value, 24);
});

test('parseCliArguments › should parse multiple arguments', () => {
  process.argv = ['node', 'script.js', '--date', '2023-01-01'];

  const result = parseCliArguments();

  assert.equal(result.timeframe?.type, 'date');
  assert.ok(result.timeframe?.value instanceof Date);
});

test('parseCliArguments › should throw error for unknown argument', () => {
  process.argv = ['node', 'script.js', '--unknown'];

  try {
    parseCliArguments();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.ok(error.message.includes('Unknown argument: --unknown'));
  }
});

test('parseCliArguments › should throw error for invalid date format', () => {
  process.argv = ['node', 'script.js', '--date', 'invalid-date'];

  try {
    parseCliArguments();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.ok(error.message.includes('Invalid date argument: invalid-date'));
  }
});

test('parseCliArguments › should throw error for invalid date value', () => {
  process.argv = ['node', 'script.js', '--date', '2023-13-45'];

  try {
    parseCliArguments();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.match(error.message, 'Invalid date format: 2023-13-45');
  }
});

test('parseCliArguments › should throw error for invalid hours value', () => {
  process.argv = ['node', 'script.js', '--hours', 'abc'];

  try {
    parseCliArguments();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.match(error.message, 'Hours must be a positive number, got: abc');
  }
});

test('parseCliArguments › should throw error for negative hours', () => {
  process.argv = ['node', 'script.js', '--hours', '-5'];

  try {
    parseCliArguments();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.match(error.message, 'Hours must be a positive number, got: -5');
  }
});

test('parseCliArguments › should throw error for zero hours', () => {
  process.argv = ['node', 'script.js', '--hours', '0'];

  try {
    parseCliArguments();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.match(error.message, 'Hours must be a positive number, got: 0');
  }
});

test('environment variable test', () => {
  process.env.TEST_VAR = 'test_value';
  assert.equal(process.env.TEST_VAR, 'test_value');
});

test('environment variable persistence test', () => {
  // Test 1: Set a variable
  process.env.TEST_PERSIST = 'value1';
  assert.equal(process.env.TEST_PERSIST, 'value1');

  // Test 2: Modify the variable
  process.env.TEST_PERSIST = 'value2';
  assert.equal(process.env.TEST_PERSIST, 'value2');

  // Test 3: Set another variable
  process.env.TEST_PERSIST_2 = 'value3';
  assert.equal(process.env.TEST_PERSIST_2, 'value3');

  // Test 4: Check both are still there
  assert.equal(process.env.TEST_PERSIST, 'value2');
  assert.equal(process.env.TEST_PERSIST_2, 'value3');
});

test('applyCliOverrides › direct test without mocking', () => {
  // Temporarily restore original console to see what's happening
  const originalLog = console.log;
  console.log = originalConsole.log;

  const config: CliConfig = { timeframe: { type: 'date', value: new Date() } };

  // Clear any existing value
  delete process.env.RELEASE_WINDOW;

  console.log('Before:', process.env.TARGET_DATE);
  applyCliOverrides(config);
  console.log('After:', process.env.TARGET_DATE);

  assert.equal(process.env.TARGET_DATE, new Date().toISOString().split('T')[0]);

  // Restore mock
  console.log = originalLog;
});

test('applyCliOverrides › should set environment variables for target date', () => {
  const config: CliConfig = { timeframe: { type: 'date', value: new Date('2023-07-14') } };

  applyCliOverrides(config);

  assert.equal(process.env.TARGET_DATE, '2023-07-14');
});

test('applyCliOverrides › should set environment variables for hours back', () => {
  const config: CliConfig = { timeframe: { type: 'hours', value: 48 } };

  applyCliOverrides(config);

  assert.equal(process.env.HOURS_BACK, '48');
});

test('applyCliOverrides › should set environment variables for days back', () => {
  const config: CliConfig = {
    timeframe: { type: 'days', value: 7 }
  };

  applyCliOverrides(config);

  assert.equal(process.env.DAYS_BACK, '7');
});

test('applyCliOverrides › should not set environment variables for undefined values', () => {
  const originalEnv = { ...process.env };
  const config: CliConfig = {};

  applyCliOverrides(config);

  // Environment should remain unchanged for undefined config values
  assert.equal(process.env.TARGET_DATE, originalEnv.TARGET_DATE);
  assert.equal(process.env.HOURS_BACK, originalEnv.HOURS_BACK);
  assert.equal(process.env.DAYS_BACK, originalEnv.DAYS_BACK);
});

test('processCli › should return false when help is requested', () => {
  process.argv = ['node', 'script.js', '--help'];

  const result = processCli();

  assert.equal(result, false);
  assert.ok(mockConsole.log.called);
});

test('processCli › should return true and apply overrides for valid arguments', () => {
  process.argv = ['node', 'script.js', '--date', '2023-07-14'];

  const result = processCli();

  assert.equal(result, true);
  assert.equal(process.env.TARGET_DATE, '2023-07-14');
});

test('processCli › should return true when no arguments provided', () => {
  process.argv = ['node', 'script.js'];

  const result = processCli();

  assert.equal(result, true);
});

test('processCli › should handle errors and call process.exit', () => {
  process.argv = ['node', 'script.js', '--invalid-arg'];

  try {
    processCli();
    assert.unreachable('should have thrown process.exit error');
  } catch (error: any) {
    assert.match(error.message, 'process.exit(1)');
    assert.ok(mockConsole.error.called);
    assert.ok(mockConsole.log.called);
  }
});

test.run();
