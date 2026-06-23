import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Configuración del proyecto Supabase, guardada localmente. Permite activar
// la nube sin recompilar: el usuario pega su URL y su clave anónima (anon key).

const CONFIG_KEY = "glyphy.supabase.config";

export interface SupaConfig {
  url: string;
  anonKey: string;
}

let client: SupabaseClient | null = null;

export function getConfig(): SupaConfig | null {
  const raw = localStorage.getItem(CONFIG_KEY);
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as SupaConfig;
    return c.url && c.anonKey ? c : null;
  } catch {
    return null;
  }
}

export function saveConfig(c: SupaConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(c));
  client = null;
}

export function clearConfig() {
  localStorage.removeItem(CONFIG_KEY);
  client = null;
}

export function isConfigured() {
  return !!getConfig();
}

export function getClient(): SupabaseClient | null {
  if (client) return client;
  const cfg = getConfig();
  if (!cfg) return null;
  client = createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "glyphy.sb.auth" },
  });
  return client;
}
