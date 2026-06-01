import { log } from '../src/utils/logger';

describe('logger', () => {
  let warnSpy, errorSpy, logSpy;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    global.__DEV__ = true;
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  test('warn prefixes with tag', () => {
    log.warn('Foo', 'something went wrong');
    expect(warnSpy).toHaveBeenCalledWith('[Foo]', 'something went wrong');
  });

  test('error prefixes with tag and supports objects', () => {
    const err = new Error('boom');
    log.error('Foo', 'failure', err);
    expect(errorSpy).toHaveBeenCalledWith('[Foo]', 'failure', err);
  });

  test('info goes to console.log', () => {
    log.info('Foo', 'hi');
    expect(logSpy).toHaveBeenCalledWith('[Foo]', 'hi');
  });

  test('silent in production', () => {
    global.__DEV__ = false;
    log.warn('Foo', 'should be silent');
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
