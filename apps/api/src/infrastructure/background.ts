import { after } from 'next/server'

/**
 * Runs work after the response is sent (Vercel keeps the function alive for
 * it), so notification emails don't slow down the request. Outside a request
 * (tests, scripts) the task just runs.
 */
export function defer(task: () => Promise<unknown>): void {
  const run = () => task().catch((error) => console.error('[background] task failed', error))
  try {
    after(run)
  } catch {
    void run()
  }
}
