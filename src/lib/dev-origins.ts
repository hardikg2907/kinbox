import { networkInterfaces } from "node:os";

// In development only: this Mac's own Wi-Fi/LAN addresses, so a phone on the
// same network can open the dev server and sign in. Never used in production.
export function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((iface) => iface !== undefined && iface.family === "IPv4" && !iface.internal)
    .map((iface) => iface!.address);
}

export function lanOrigins(port: string): string[] {
  return lanAddresses().map((address) => `http://${address}:${port}`);
}
