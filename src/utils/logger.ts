// ロギングユーティリティ

const getTimestamp = (): string => {
  return new Date().toISOString();
};

export const logger = {
  info: (message: string, ...args: any[]) => {
    console.log(`[${getTimestamp()}] [INFO]`, message, ...args);
  },
  
  error: (message: string, error?: any) => {
    console.error(`[${getTimestamp()}] [ERROR]`, message, error);
  },
  
  warn: (message: string, ...args: any[]) => {
    console.warn(`[${getTimestamp()}] [WARN]`, message, ...args);
  },
  
  debug: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[${getTimestamp()}] [DEBUG]`, message, ...args);
    }
  },
};
