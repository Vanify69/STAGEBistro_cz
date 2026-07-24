import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { usePermissions } from '@/lib/usePermissions';
import { canAccessProvoz } from '@/lib/permissions';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function detectPlatform(): 'ios' | 'android' | 'desktop' {
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export default function ProvozAplikacePage() {
  const { permissions } = usePermissions();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');

  const installUrl = useMemo(() => {
    if (typeof window === 'undefined') return '/provoz/objednavky';
    return `${window.location.origin}/provoz/objednavky`;
  }, []);

  const qrUrl = useMemo(() => {
    const data = encodeURIComponent(installUrl);
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${data}`;
  }, [installUrl]);

  useEffect(() => {
    setPlatform(detectPlatform());
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(standalone);

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!deferred) return;
    setInstalling(true);
    try {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
    } finally {
      setInstalling(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(installUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (!canAccessProvoz(permissions)) {
    return <p className="text-sm text-black/60">Nemáte přístup do provozu.</p>;
  }

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <section className="space-y-4 text-center">
        <img
          src="/provoz-logo.png"
          alt="Stage Bistro – provoz"
          className="mx-auto h-28 w-28 rounded-2xl border border-black/10"
        />
        <div>
          <h2 className="text-xl font-medium tracking-tight">Aplikace na telefon</h2>
          <p className="mt-2 text-sm text-black/60">
            Nejde o stahování z App Store / Google Play. Je to webová aplikace (PWA), kterou si přidáte
            na plochu telefonu — pak se otevře jako běžná appka.
          </p>
        </div>
      </section>

      {installed ? (
        <section className="border border-black/10 bg-black/[0.02] p-4 text-sm">
          Aplikace už běží v režimu na ploše. Ikona <strong>Provoz</strong> by měla být mezi ostatními appkami.
        </section>
      ) : (
        <section className="space-y-3">
          {deferred ? (
            <Button type="button" className="h-12 w-full" disabled={installing} onClick={() => void handleInstall()}>
              {installing ? 'Instaluji…' : 'Nainstalovat Stage Bistro – provoz'}
            </Button>
          ) : (
            <p className="text-sm text-black/60">
              {platform === 'ios'
                ? 'Na iPhonu prohlížeč nenabízí tlačítko instalace — použijte postup níže (Přidat na plochu).'
                : platform === 'android'
                  ? 'Otevřete tuto stránku v Chrome na telefonu. Pokud se tlačítko neobjeví, použijte menu prohlížeče → „Nainstalovat aplikaci“ / „Přidat na plochu“.'
                  : 'Na počítači naskenujte QR kód telefonem, nebo zkopírujte odkaz a otevřete ho v mobilním Chrome / Safari.'}
            </p>
          )}
        </section>
      )}

      <section className="space-y-3 border border-black/10 p-4">
        <h3 className="font-medium">Otevřít na telefonu</h3>
        <p className="text-sm text-black/60">Naskenujte QR nebo zkopírujte odkaz (po přihlášení otevře Objednávky).</p>
        <div className="flex justify-center bg-white p-3">
          <img src={qrUrl} alt="QR kód na provozní aplikaci" width={220} height={220} className="h-[220px] w-[220px]" />
        </div>
        <p className="break-all text-center text-xs text-black/50">{installUrl}</p>
        <Button type="button" variant="outline" className="w-full" onClick={() => void copyLink()}>
          {copied ? 'Zkopírováno' : 'Kopírovat odkaz'}
        </Button>
      </section>

      <section className="space-y-3 border border-black/10 p-4 text-sm">
        <h3 className="font-medium">iPhone (Safari)</h3>
        <ol className="list-decimal space-y-1 pl-5 text-black/70">
          <li>Otevřete odkaz výše v Safari (ne v Chrome).</li>
          <li>Přihlaste se do provozu.</li>
          <li>Klepněte na Sdílet (čtverec se šipkou nahoru).</li>
          <li>Zvolte „Přidat na plochu“ → Přidat.</li>
        </ol>
      </section>

      <section className="space-y-3 border border-black/10 p-4 text-sm">
        <h3 className="font-medium">Android (Chrome)</h3>
        <ol className="list-decimal space-y-1 pl-5 text-black/70">
          <li>Otevřete odkaz v Chrome.</li>
          <li>Přihlaste se do provozu.</li>
          <li>Menu (⋮) → „Nainstalovat aplikaci“ nebo „Přidat na plochu“.</li>
          <li>Nebo použijte zelené tlačítko nahoře, pokud ho Chrome nabídne.</li>
        </ol>
      </section>
    </div>
  );
}
