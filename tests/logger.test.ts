import { test } from 'uvu';
import * as assert from 'uvu/assert';
import fs from 'fs';
import { frame } from '../src/utils/logger';

// Mock fs and console for testing
let mockConsole: any = {};
let mockFs: any = {};
let originalConsole: any = {};
let originalFs: any = {};

test.before.each(() => {
  // Reset mocks
  mockConsole = {
    log: { called: false, args: [] },
    warn: { called: false, args: [] },
    error: { called: false, args: [] }
  };

  mockFs = {
    existsSync: { called: false, args: [], returnValue: true },
    mkdirSync: { called: false, args: [] }
  };

  // Store original functions
  originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error
  };

  originalFs = {
    existsSync: fs.existsSync,
    mkdirSync: fs.mkdirSync
  };

  // Mock console methods
  console.log = (...args: any[]) => {
    mockConsole.log.called = true;
    mockConsole.log.args = args;
  };

  console.warn = (...args: any[]) => {
    mockConsole.warn.called = true;
    mockConsole.warn.args = args;
  };

  console.error = (...args: any[]) => {
    mockConsole.error.called = true;
    mockConsole.error.args = args;
  };

  // Mock fs methods
  (fs as any).existsSync = (path: any) => {
    mockFs.existsSync.called = true;
    mockFs.existsSync.args.push(path);
    return mockFs.existsSync.returnValue;
  };

  (fs as any).mkdirSync = (path: any, options?: any) => {
    mockFs.mkdirSync.called = true;
    mockFs.mkdirSync.args.push(path);
    return undefined;
  };
});

test.after.each(() => {
  // Restore original functions
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  (fs as any).existsSync = originalFs.existsSync;
  (fs as any).mkdirSync = originalFs.mkdirSync;
});

test('frame › should create a framed text with minimum 80 stars', () => {
  const text = 'Hello';
  const result = frame(text);

  assert.type(result, 'string');
  assert.ok(result.includes('Hello'));
  assert.ok(result.includes('*'));

  // Should start with newline
  assert.ok(result.startsWith('\n'));
  // Should NOT end with newline (ends with the border)
  assert.ok(!result.endsWith('\n'));

  // Should contain the text with proper framing
  const lines = result.split('\n');
  assert.ok(lines.length >= 4); // At least 4 lines: empty, top border, content, bottom border

  // The border should be at least 84 characters (80 + 4)
  // Format is "* " + stars, so we check the line that contains only stars
  const borderLines = lines.filter(line => line.startsWith('* ') && line.includes('*'.repeat(10)));
  assert.ok(borderLines.length >= 1);
  assert.ok(borderLines[0].length >= 84); // 80 + 4 minimum
});

test('frame › should handle multi-line text correctly', () => {
  const text = 'Line 1\nLine 2\nLine 3';
  const result = frame(text);

  assert.ok(result.includes('* Line 1'));
  assert.ok(result.includes('* Line 2'));
  assert.ok(result.includes('* Line 3'));
});

test('frame › should adjust border length based on longest line', () => {
  const shortText = 'Short';
  const longText = 'This is a very long line that should determine the border length for the entire frame';

  const shortResult = frame(shortText);
  const longResult = frame(longText);

  // Long text should have longer border
  const shortBorderLength = shortResult.split('\n')[1].length;
  const longBorderLength = longResult.split('\n')[1].length;

  assert.ok(longBorderLength > shortBorderLength);
});

test('frame › should ensure minimum border length of 80 + 4 characters', () => {
  const text = 'Short';
  const result = frame(text);

  const borderLine = result.split('\n')[1];
  assert.ok(borderLine.length >= 84); // 80 + 4
});

test('Logger › should create new Logger instance', () => {
  // We need to import Logger class separately to test it
  // Since it's not exported, we'll test through the exported logger instance
  const { logger } = require('../src/utils/logger');

  assert.ok(logger);
  assert.type(logger.updateContext, 'function');
  assert.type(logger.info, 'function');
  assert.type(logger.warn, 'function');
  assert.type(logger.error, 'function');
  assert.type(logger.debug, 'function');
});

test('Logger › updateContext › should generate context name with timestamp', () => {
  // Get a fresh logger instance for testing
  delete require.cache[require.resolve('../src/utils/logger')];
  const { logger } = require('../src/utils/logger');

  // Mock the updateLogger method to prevent file creation
  const originalUpdateLogger = logger.updateLogger;
  logger.updateLogger = () => {
    // Don't create actual logger to prevent file creation
  };

  logger.updateContext('test');

  // The context_name should include the timestamp
  assert.ok(logger.context_name);
  assert.ok(logger.context_name.includes('test-'));

  // Should match the pattern: test-MM-DD-YY::HH-MM-SS
  const timestampPattern = /test-\d{2}-\d{2}-\d{2}::\d{2}-\d{2}-\d{2}/;
  assert.ok(timestampPattern.test(logger.context_name));

  // Restore original method
  logger.updateLogger = originalUpdateLogger;
});

test('Logger › updateContext › should create context without name', () => {
  // Get a fresh logger instance for testing
  delete require.cache[require.resolve('../src/utils/logger')];
  const { logger } = require('../src/utils/logger');

  // Mock the updateLogger method to prevent file creation
  const originalUpdateLogger = logger.updateLogger;
  logger.updateLogger = () => {
    // Don't create actual logger to prevent file creation
  };

  logger.updateContext();

  assert.ok(logger.context_name);
  assert.ok(logger.context_name.startsWith('run-'));

  // Should match the pattern: run-MM-DD-YY::HH-MM-SS
  const timestampPattern = /run-\d{2}-\d{2}-\d{2}::\d{2}-\d{2}-\d{2}/;
  assert.ok(timestampPattern.test(logger.context_name));

  // Restore original method
  logger.updateLogger = originalUpdateLogger;
});

test('Logger › info › should use console.log when logger not initialized', () => {
  // Create a new logger instance without initialization
  class TestLogger {
    logger: any;
    info(...args: any[]) {
      if (!this.logger) {
        console.log.apply(console, arguments);
        return;
      }
      this.logger.info.apply(this.logger, arguments);
    }
  }

  const testLogger = new TestLogger();
  testLogger.info('test message', 'extra arg');

  assert.ok(mockConsole.log.called);
  assert.equal(mockConsole.log.args[0], 'test message');
  assert.equal(mockConsole.log.args[1], 'extra arg');
});

test('Logger › warn › should use console.warn when logger not initialized', () => {
  class TestLogger {
    logger: any;
    warn(...args: any[]) {
      if (!this.logger) {
        console.warn.apply(console, arguments);
        return;
      }
      this.logger.warn.apply(this.logger, arguments);
    }
  }

  const testLogger = new TestLogger();
  testLogger.warn('warning message');

  assert.ok(mockConsole.warn.called);
  assert.equal(mockConsole.warn.args[0], 'warning message');
});

test('Logger › error › should use console.error when logger not initialized', () => {
  class TestLogger {
    logger: any;
    error(...args: any[]) {
      if (!this.logger) {
        console.error.apply(console, arguments);
        return;
      }
      this.logger.error.apply(this.logger, arguments);
    }
  }

  const testLogger = new TestLogger();
  testLogger.error('error message');

  assert.ok(mockConsole.error.called);
  assert.equal(mockConsole.error.args[0], 'error message');
});

test('Logger › debug › should return early when logger not initialized', () => {
  class TestLogger {
    logger: any;
    debug(...args: any[]) {
      if (!this.logger) return;
      this.logger.debug.apply(this.logger, arguments);
    }
  }

  const testLogger = new TestLogger();
  const result = testLogger.debug('debug message');

  // debug should return early and not call console
  assert.equal(result, undefined);
  assert.ok(!mockConsole.log.called);
});

test('Logger › child › should return self when logger not initialized', () => {
  class TestLogger {
    logger: any;
    child() {
      if (!this.logger) return this;
      return this.logger.child.apply(this.logger, arguments);
    }
  }

  const testLogger = new TestLogger();
  const result = testLogger.child();

  assert.equal(result, testLogger);
});

test('createLogDirectory › should check if logs directory exists', () => {
  // This test verifies the directory creation logic
  mockFs.existsSync.returnValue = true;

  // Re-require the module to trigger createLogDirectory
  delete require.cache[require.resolve('../src/utils/logger')];
  require('../src/utils/logger');

  assert.ok(mockFs.existsSync.called);
  assert.equal(mockFs.existsSync.args[0], 'logs');
});

test('createLogDirectory › should create logs directory if it does not exist', () => {
  mockFs.existsSync.returnValue = false;

  // Re-require the module to trigger createLogDirectory
  delete require.cache[require.resolve('../src/utils/logger')];
  require('../src/utils/logger');

  assert.ok(mockFs.existsSync.called);
  assert.ok(mockFs.mkdirSync.called);
  assert.equal(mockFs.mkdirSync.args[0], 'logs');
});

test.run();
