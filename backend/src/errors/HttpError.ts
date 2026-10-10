/**
 * An error with an HTTP status and a client-safe code and message.
 * Throw it from handlers; errorHandler turns it into the API error format.
 * The optional `cause` is logged on the server and never sent to the client.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'HttpError';
  }
}
