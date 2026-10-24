type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function formatMessage(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>): void => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatMessage('debug', message, context));
    }
  },

  info: (message: string, context?: Record<string, unknown>): void => {
    console.info(formatMessage('info', message, context));
  },

  warn: (message: string, context?: Record<string, unknown>): void => {
    console.warn(formatMessage('warn', message, context));
  },

  error: (message: string, context?: Record<string, unknown>): void => {
    console.error(formatMessage('error', message, context));
  },
};

export function formatError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
