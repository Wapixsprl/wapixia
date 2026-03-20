// @wapixia/queue — Invoice generation worker

import { Worker, type Job } from 'bullmq'
import { connection, QUEUE_NAMES } from '../config.js'
import type { InvoiceJobData, InvoiceResult } from '../types.js'
import { workerLogger } from '../logger.js'
import { createSupabaseClient } from '../services/supabase.js'

const WORKER_NAME = 'invoice'

/**
 * Call the API invoice generator service to produce a PDF.
 * Returns the public URL of the generated invoice PDF.
 */
async function callInvoiceGenerator(paymentId: string): Promise<string> {
  const apiBaseUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000'
  const apiKey = process.env.API_INTERNAL_KEY ?? ''

  const response = await fetch(`${apiBaseUrl}/internal/billing/invoices/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-key': apiKey,
    },
    body: JSON.stringify({ paymentId }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Invoice API error (${response.status}): ${errorText}`)
  }

  const data = (await response.json()) as { invoicePdfUrl: string }
  return data.invoicePdfUrl
}

async function processInvoice(
  job: Job<InvoiceJobData>,
): Promise<InvoiceResult> {
  const { paymentId } = job.data
  const jobId = job.id ?? 'unknown'
  const ctx = { worker: WORKER_NAME, jobId, paymentId }

  workerLogger.info('Starting invoice generation', ctx)

  const supabase = createSupabaseClient()

  // Verify payment exists
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('id, status, invoice_pdf_url')
    .eq('id', paymentId)
    .single()

  if (paymentError || !payment) {
    throw new Error(`Payment not found: ${paymentId}`)
  }

  // Skip if invoice already generated
  if (payment.invoice_pdf_url) {
    workerLogger.info('Invoice already generated, skipping', ctx)
    return { paymentId, invoicePdfUrl: payment.invoice_pdf_url as string }
  }

  // Generate invoice via API service
  const invoicePdfUrl = await callInvoiceGenerator(paymentId)

  // Update payment with invoice URL
  const { error: updateError } = await supabase
    .from('payments')
    .update({
      invoice_pdf_url: invoicePdfUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId)

  if (updateError) {
    throw new Error(`Failed to update payment with invoice URL: ${updateError.message}`)
  }

  workerLogger.info('Invoice generated successfully', {
    ...ctx,
    invoicePdfUrl,
  })

  return { paymentId, invoicePdfUrl }
}

// ── Worker instance ──

export const invoiceWorker = new Worker<InvoiceJobData, InvoiceResult>(
  QUEUE_NAMES.INVOICE,
  processInvoice,
  {
    connection,
    concurrency: 3,
    limiter: { max: 20, duration: 60_000 },
  },
)

invoiceWorker.on('completed', (job) => {
  workerLogger.info('Job completed', {
    worker: WORKER_NAME,
    jobId: job.id ?? 'unknown',
    paymentId: job.data.paymentId,
  })
})

invoiceWorker.on('failed', (job, error) => {
  workerLogger.error('Job failed', {
    worker: WORKER_NAME,
    jobId: job?.id ?? 'unknown',
    paymentId: job?.data.paymentId,
    error,
  })
})
