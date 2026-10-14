/**
 * User-facing text for a failed request. Server-side failures get a short reference
 * (the start of the X-Request-Id) that support can search the backend logs for.
 */
export function describeError(err, fallback = 'Something went wrong. Please try again.') {
  const res = err?.response;
  const message = res?.data?.error || err?.message || fallback;
  const requestId = res?.data?.requestId || res?.headers?.['x-request-id'];
  if (!requestId || !(res.status >= 500)) return message;
  return `${message} (ref: ${String(requestId).slice(0, 8)})`;
}
