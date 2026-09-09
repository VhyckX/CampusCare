import dns from "node:dns";
import net from "node:net";

export function configureDnsServers() {
  const dnsServersValue = process.env.DNS_SERVERS;

  if (!dnsServersValue || !dnsServersValue.trim()) {
    return;
  }

  const dnsServers = dnsServersValue.split(",").map((server) => server.trim()).filter(Boolean);

  if (!dnsServers.length) {
    return;
  }

  const invalidServers = dnsServers.filter((server) => net.isIP(server) === 0);

  if (invalidServers.length) {
    throw new Error("Invalid DNS_SERVERS configuration. Use comma-separated DNS server IP addresses.");
  }

  try {
    dns.setServers(dnsServers);
  } catch (error) {
    throw new Error("Invalid DNS_SERVERS configuration. Node.js could not apply the supplied DNS server IP addresses.");
  }
}
