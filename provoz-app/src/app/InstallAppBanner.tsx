import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && Boolean((navigator as { standalone?: boolean }).standalone))
  );
}

/** Nabídne nativní Chrome „Nainstalovat“ (WebAPK) — ne zkratku s odznakem prohlížeče. */
export function InstallAppBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setDismissed(true);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (dismissed || isStandalone() || !deferred) return null;

  async function install() {
    if (!deferred || busy) return;
    setBusy(true);
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') setDismissed(true);
      setDeferred(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-4 mb-3 rounded-none border border-white/15 bg-[#111] p-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-white/80">
          <Download size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Nainstalovat jako aplikaci
          </p>
          <p className="mt-0.5 text-xs text-white/50" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Ikona bez odznaku Chrome, otevře se přes celou obrazovku.
          </p>
          <button
            type="button"
            onClick={() => void install()}
            disabled={busy}
            className="mt-2 w-full bg-white px-3 py-2 text-sm font-medium text-black disabled:opacity-60"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            {busy ? 'Instaluji…' : 'Nainstalovat'}
          </button>
        </div>
        <button
          type="button"
          aria-label="Zavřít"
          className="text-white/40"
          onClick={() => setDismissed(true)}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
