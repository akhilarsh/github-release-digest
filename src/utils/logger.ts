import filenamify from 'filenamify';
import * as fs from 'fs';
import { pino } from 'pino';

const LOGS_FOLDER = 'logs';
const LOG_TIME_STAMP = 'UTC:yyyy-mm-dd HH:MM:ss.l o';

const redact = ['secrets'];

export function frame(text: string) {
  const min_stars = 80;
  const borderLength = Math.max(...text.split('\n').map((line) => line.length), min_stars) + 4;
  const stars = '*'.repeat(borderLength);
  const stars_line = `* ${stars}`;
  return `\n${stars_line}\n* ${text.replace(/\n/g, '\n* ')}\n${stars_line}`;
}

function createLogDirectory() {
  if (!fs.existsSync(LOGS_FOLDER)) {
    fs.mkdirSync(LOGS_FOLDER);
  }
}

class Logger {
  logger: pino.Logger;

  context_name: string;

  updateLogger() {
    const logFileName = this.context_name || 'application';

    this.logger = pino({
      transport: {
        targets: [
          {
            level: 'trace',
            target: 'pino-pretty',
            options: {
              destination: `${LOGS_FOLDER}/${logFileName}.log`,
              colorize: false,
              translateTime: LOG_TIME_STAMP,
            },
          },
          {
            level: 'info',
            target: 'pino-pretty',
            options: { destination: 1, translateTime: LOG_TIME_STAMP },
          },
        ],
      },
      redact,
    });
    this.logger.level = 'trace';
  }

  updateContext(name?: string) {
    if (this.logger) {
      this.logger.flush();
    }

    // Format timestamp for filename: release-summary-07-14-25::11-12-38
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${month}-${day}-${year}-${hours}-${minutes}-${seconds}`;

    this.context_name = name ? `${name}-${timestamp}` : `run-${timestamp}`;
    this.updateLogger();
  }

  child() {
    if (!this.logger) return this;
    return this.logger.child.apply(this.logger, arguments);
  }

  debug(_?: any, __?: string) {
    if (!this.logger) return;
    this.logger.debug.apply(this.logger, arguments);
  }

  info(_?: any, __?: string) {
    if (!this.logger) {
      console.log.apply(console, arguments);
      return;
    }
    this.logger.info.apply(this.logger, arguments);
  }

  warn(_?: any, __?: string) {
    if (!this.logger) {
      console.warn.apply(console, arguments);
      return;
    }
    this.logger.warn.apply(this.logger, arguments);
  }

  error(_?: any, __?: string) {
    if (!this.logger) {
      console.error.apply(console, arguments);
      return;
    }
    this.logger.error.apply(this.logger, arguments);
  }
}

export const logger = new Logger();
createLogDirectory();
