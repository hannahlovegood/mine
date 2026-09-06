// CORS for the API routes (/api/interpret, /api/plain), shared by the Vercel functions and the
// Vite dev/preview router. The extension calls the API from whatever page the person is on, so
// both routes answer any origin. Nothing here is authenticated; the provider key never leaves
// the server either way.

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
} as const;

/** The slice of node's ServerResponse (and so of Vercel's response) the helper touches. */
export interface CorsResponse {
  statusCode: number;
  setHeader(name: string, value: string): unknown;
  end(): unknown;
}

/**
 * Sets the CORS headers on every response. An OPTIONS preflight is answered here with 204;
 * the return value says whether the request has been fully handled, so a route does
 * `if (cors(req.method, res)) return;` before its own method check.
 */
export function cors(method: string | undefined, res: CorsResponse): boolean {
  for (const [name, value] of Object.entries(CORS_HEADERS)) res.setHeader(name, value);
  if ((method ?? '').toUpperCase() !== 'OPTIONS') return false;
  res.statusCode = 204;
  res.end();
  return true;
}
