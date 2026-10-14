const logger = require('./logger');

/**
 * Opens a Server-Sent Events response. The returned signal aborts when the client disconnects.
 */
function openEventStream(res) {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort(new Error('Client disconnected'));
  });

  return {
    signal: controller.signal,
    send(event, data) {
      if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    fail(error, route) {
      if (controller.signal.aborted) return;
      if (!error.expose) logger.error('Stream failed', { requestId: res.req?.id, route, err: error.stack || error.message });
      this.send('error', {
        error: error.expose ? error.message : 'Something went wrong on our side. Please try again.',
        code: error.expose ? error.code : 'INTERNAL_ERROR',
        requestId: res.req?.id,
      });
    },
    end() {
      if (!res.writableEnded) res.end();
    },
  };
}

module.exports = { openEventStream };
