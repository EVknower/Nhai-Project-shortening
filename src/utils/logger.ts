/**
 * Utility logger — wraps console methods with levels.
 * In production builds, INFO logs are suppressed.
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LOG_LEVEL: LogLevel = __DEV__ ? 'DEBUG' : 'WARN';

const levels: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

function shouldLog(level: LogLevel): boolean {
  return levels[level] >= levels[LOG_LEVEL];
}

export const logger = {
  debug: (msg: string, ...args: any[]) => {
    if (shouldLog('DEBUG')) {
      console.log(`[DEBUG] ${msg}`, ...args);
    }
  },
  info: (msg: string, ...args: any[]) => {
    if (shouldLog('INFO')) {
      console.log(`[INFO] ${msg}`, ...args);
    }
  },
  warn: (msg: string, ...args: any[]) => {
    if (shouldLog('WARN')) {
      console.warn(`[WARN] ${msg}`, ...args);
    }
  },
  error: (msg: string, ...args: any[]) => {
    if (shouldLog('ERROR')) {
      console.error(`[ERROR] ${msg}`, ...args);
    }
  },
};
