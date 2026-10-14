import { describeError } from './errors';

describe('describeError', () => {
  it('appends a short reference for server-side failures', () => {
    const err = { response: { status: 500, data: { error: 'Something went wrong on our side.', requestId: 'abcdef12-3456-7890' } } };
    expect(describeError(err)).toBe('Something went wrong on our side. (ref: abcdef12)');
  });

  it('shows client errors as-is', () => {
    const err = { response: { status: 400, data: { error: 'Message is too long.', requestId: 'abcdef12' } } };
    expect(describeError(err)).toBe('Message is too long.');
  });

  it('falls back to the error message, then the provided fallback', () => {
    expect(describeError(new Error('Network Error'))).toBe('Network Error');
    expect(describeError(null, 'Failed to load.')).toBe('Failed to load.');
  });
});
