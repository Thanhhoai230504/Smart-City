const dns = require('dns');
const net = require('net');

const PUBLIC_DNS_FALLBACK = Object.freeze(['1.1.1.1', '8.8.8.8']);

const parseDnsServers = (value) => String(value || '')
  .split(',')
  .map((server) => server.trim())
  .filter(Boolean);

const isLoopbackDns = (server) => server === '::1' || server.startsWith('127.');

/**
 * Node dùng c-ares cho truy vấn SRV của mongodb+srv. Trên một số máy Windows,
 * Internet Connection Sharing đưa c-ares về 127.0.0.1 nhưng proxy này từ chối
 * SRV. Chỉ thay resolver trong tiến trình Node, không sửa DNS của hệ điều hành.
 */
const configureDnsServers = ({
  dnsModule = dns,
  configuredServers = process.env.DNS_SERVERS,
  logger = console,
} = {}) => {
  const currentServers = dnsModule.getServers();
  const requestedServers = parseDnsServers(configuredServers);

  if (requestedServers.some((server) => net.isIP(server) === 0)) {
    throw new Error('DNS_SERVERS chỉ được chứa địa chỉ IP, phân tách bằng dấu phẩy');
  }

  const usingLoopbackOnly = currentServers.length > 0
    && currentServers.every(isLoopbackDns);
  const selectedServers = requestedServers.length
    ? requestedServers
    : usingLoopbackOnly
      ? [...PUBLIC_DNS_FALLBACK]
      : currentServers;
  const changed = selectedServers.join(',') !== currentServers.join(',');

  if (changed) {
    dnsModule.setServers(selectedServers);
    if (usingLoopbackOnly && !requestedServers.length) {
      logger.warn('⚠️ Node DNS localhost không hỗ trợ SRV; dùng DNS fallback cho tiến trình này');
    }
  }

  return {
    changed,
    servers: selectedServers,
    usedLoopbackFallback: usingLoopbackOnly && !requestedServers.length,
  };
};

module.exports = {
  PUBLIC_DNS_FALLBACK,
  parseDnsServers,
  configureDnsServers,
};
