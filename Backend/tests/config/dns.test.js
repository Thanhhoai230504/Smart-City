const {
  PUBLIC_DNS_FALLBACK,
  parseDnsServers,
  configureDnsServers,
} = require('../../src/config/dns');

describe('DNS configuration', () => {
  it('parses a comma-separated server list', () => {
    expect(parseDnsServers('1.1.1.1, 8.8.8.8')).toEqual(['1.1.1.1', '8.8.8.8']);
  });

  it('uses a process-local fallback when Node only sees localhost', () => {
    const dnsModule = {
      getServers: jest.fn().mockReturnValue(['127.0.0.1']),
      setServers: jest.fn(),
    };
    const logger = { warn: jest.fn() };

    const result = configureDnsServers({ dnsModule, configuredServers: '', logger });

    expect(dnsModule.setServers).toHaveBeenCalledWith(PUBLIC_DNS_FALLBACK);
    expect(result.usedLoopbackFallback).toBe(true);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('respects DNS_SERVERS and leaves a working resolver unchanged', () => {
    const explicitDns = {
      getServers: jest.fn().mockReturnValue(['127.0.0.1']),
      setServers: jest.fn(),
    };
    configureDnsServers({
      dnsModule: explicitDns,
      configuredServers: '9.9.9.9',
      logger: { warn: jest.fn() },
    });
    expect(explicitDns.setServers).toHaveBeenCalledWith(['9.9.9.9']);

    const workingDns = {
      getServers: jest.fn().mockReturnValue(['1.1.1.1']),
      setServers: jest.fn(),
    };
    const result = configureDnsServers({ dnsModule: workingDns, configuredServers: '' });
    expect(workingDns.setServers).not.toHaveBeenCalled();
    expect(result.changed).toBe(false);
  });

  it('rejects invalid configured resolver values', () => {
    expect(() => configureDnsServers({
      dnsModule: { getServers: () => ['127.0.0.1'], setServers: jest.fn() },
      configuredServers: 'not-an-ip',
    })).toThrow('DNS_SERVERS');
  });
});
