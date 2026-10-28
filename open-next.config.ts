import { defineCloudflareConfig } from "@opennextjs/cloudflare/config";

export default defineCloudflareConfig({
  // Habilitar nodejs compat para que node:crypto (scrypt, randomBytes) funcione
  nodejsCompat: true,
});
