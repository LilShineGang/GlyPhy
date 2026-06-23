import { useState } from "react";
import { useStore } from "@/state/store";
import { useSync } from "@/state/sync";
import { getConfig } from "@/lib/supabase";
import { I } from "./Icons";

export default function CloudModal() {
  const { cloudOpen, closeCloud } = useStore();
  const sync = useSync();
  const cfg = getConfig();

  const [url, setUrl] = useState(cfg?.url ?? "");
  const [anonKey, setAnonKey] = useState(cfg?.anonKey ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!cloudOpen) return null;

  const saveConfig = async () => {
    setLocalError(null);
    if (!/^https:\/\/.+\.supabase\.co/.test(url.trim())) { setLocalError("La URL debe ser https://TU-PROYECTO.supabase.co"); return; }
    if (anonKey.trim().length < 20) { setLocalError("La anon key parece incompleta"); return; }
    await sync.configure(url, anonKey);
  };

  const submitAuth = async () => {
    setBusy(true); setLocalError(null); setNotice(null);
    try {
      if (mode === "signup") {
        const hasSession = await sync.signUp(email.trim(), password);
        if (!hasSession) setNotice("Revisa tu correo para confirmar la cuenta antes de iniciar sesión.");
      } else await sync.signIn(email.trim(), password);
    } catch (e: any) {
      setLocalError(e?.message ?? "Error de autenticación");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onClick={closeCloud}>
      <div className="palette cloud-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cloud-head">
          <div className="cloud-title"><I.Cloud width={20} /> Sincronización en la nube</div>
          <button className="icon-btn" onClick={closeCloud}><I.X /></button>
        </div>

        <div className="cloud-body">
          {sync.email ? (
            // ---- Sesión activa ----
            <div>
              <div className="cloud-status-row">
                <div className="avatar" style={{ width: 34, height: 34 }}>{sync.email[0]?.toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{sync.email}</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)" }}><SyncBadge /></div>
                </div>
                <button className="cloud-btn ghost" onClick={() => sync.signOut()}>Cerrar sesión</button>
              </div>
              <button className="cloud-btn primary full" disabled={sync.status === "syncing"} onClick={() => sync.syncNow()}>
                {sync.status === "syncing" ? "Sincronizando…" : "Sincronizar ahora"}
              </button>
              {sync.lastSync && <div className="cloud-hint">Última sincronización: {new Date(sync.lastSync).toLocaleString("es-ES")}</div>}
              <div className="cloud-hint">Tus notas, tareas, carpetas y etiquetas se sincronizan automáticamente entre dispositivos.</div>
            </div>
          ) : !sync.configured ? (
            // ---- Configurar proyecto Supabase ----
            <div>
              <p className="cloud-desc">Conecta tu proyecto de <b>Supabase</b> para sincronizar entre dispositivos. Pega la URL y la <i>anon key</i> (Project Settings → API).</p>
              <label className="cloud-label">URL del proyecto</label>
              <input className="cloud-input" placeholder="https://xxxx.supabase.co" value={url} onChange={(e) => setUrl(e.target.value)} />
              <label className="cloud-label">Anon key (public)</label>
              <input className="cloud-input" placeholder="eyJhbGciOi…" value={anonKey} onChange={(e) => setAnonKey(e.target.value)} />
              {localError && <div className="cloud-error">{localError}</div>}
              <button className="cloud-btn primary full" onClick={saveConfig}>Conectar proyecto</button>
              <div className="cloud-hint">Recuerda ejecutar <code>supabase/schema.sql</code> en el editor SQL de tu proyecto.</div>
            </div>
          ) : (
            // ---- Acceso / registro ----
            <div>
              <div className="cloud-tabs">
                <button className={mode === "signin" ? "active" : ""} onClick={() => setMode("signin")}>Iniciar sesión</button>
                <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>Crear cuenta</button>
              </div>
              <label className="cloud-label">Email</label>
              <input className="cloud-input" type="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <label className="cloud-label">Contraseña</label>
              <input className="cloud-input" type="password" placeholder="••••••••" value={password}
                onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitAuth(); }} />
              {(localError || sync.error) && <div className="cloud-error">{localError || sync.error}</div>}
              {notice && <div className="cloud-hint" style={{ color: "var(--green)" }}>{notice}</div>}
              <button className="cloud-btn primary full" disabled={busy || !email || !password} onClick={submitAuth}>
                {busy ? "…" : mode === "signup" ? "Crear cuenta y sincronizar" : "Iniciar sesión"}
              </button>
              <button className="cloud-btn ghost full" onClick={() => sync.disconnect()}>Cambiar de proyecto</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SyncBadge() {
  const status = useSync((s) => s.status);
  const map: Record<string, { t: string; c: string }> = {
    off: { t: "Sin conectar", c: "var(--text-4)" },
    idle: { t: "Conectado", c: "var(--text-3)" },
    syncing: { t: "Sincronizando…", c: "var(--accent-hover)" },
    synced: { t: "Sincronizado ✓", c: "var(--green)" },
    error: { t: "Error de sync", c: "var(--red)" },
  };
  const s = map[status] ?? map.idle;
  return <span style={{ color: s.c }}>{s.t}</span>;
}
