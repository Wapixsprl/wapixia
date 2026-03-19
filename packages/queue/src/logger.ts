// @wapixia/queue — Structured logger for workers

interface LogContext {
  worker: string
  jobId: string
  siteId?: string
  contentId?: string
  reviewId?: string
  tokensUsed?: number
  [key: string]: unknown
}

function formatLog(level: string, message: string, context: LogContext): string {
  const timestamp = new Date().toISOString()
  const contextStr = JSON.stringify(context)
  return `[${timestamp}] [${level}] [${context.worker}] ${message} ${contextStr}`
}

export const workerLogger = {
  info(message: string, context: LogContext): void {
    console.log(formatLog('INFO', message, context))
  },

  warn(message: string, context: LogContext): void {
    console.warn(formatLog('WARN', message, context))
  },

  error(message: string, context: LogContext & { error?: unknown }): void {
    const errorDetail =
      context.error instanceof Error
        ? { errorMessage: context.error.message, errorStack: context.error.stack }
        : { errorMessage: String(context.error) }

    console.error(
      formatLog('ERROR', message, { ...context, ...errorDetail }),
    )
  },
}
