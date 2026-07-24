import { useMemo, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { usePermissions } from '@/lib/usePermissions';
import { canAccessProvoz } from '@/lib/permissions';

function getProvozAppUrl(): string {
  const fromEnv = (import.meta.env.VITE_PROVOZ_APP_URL as string | undefined)?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (import.meta.env.DEV) return 'http://localhost:5174';
  return 'https://provoz.stagebistro.cz';
}

function detectPlatform(): 'ios' | 'android' | 'desktop' {
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export default function ProvozAplikacePage() {
  const { permissions } = usePermissions();
  const [copied, setCopied] = useState(false);
  const platform = detectPlatform();

  const appUrl = useMemo(() => getProvozAppUrl(), []);

  const qrUrl = useMemo(() => {
    const data = encodeURIComponent(appUrl);
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${data}`;
  }, [appUrl]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(appUrl);
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
          <h2 className="text-xl font-medium tracking-tight">Mobilní aplikace Provoz</h2>
          <p className="mt-2 text-sm text-black/60">
            Samostatná appka jen na objednávky surovin a focení účtenek. Nainstalujete ji z telefonu
            (PWA) — není v App Store / Google Play.
          </p>
        </div>
        <Button type="button" className="h-12 w-full" asChild>
          <a href={appUrl} target="_blank" rel="noreferrer">
            Otevřít aplikaci
          </a>
        </Button>
      </section>

      <section className="space-y-3 border border-black/10 p-4">
        <h3 className="font-medium">QR kód na telefon</h3>
        <p className="text-sm text-black/60">
          {platform === 'desktop'
            ? 'Naskenujte telefonem, přihlaste se a přidejte appku na plochu.'
            : 'Otevřete odkaz níže v prohlížeči a přidejte na plochu.'}
        </p>
        <div className="flex justify-center bg-white p-3">
          <img src={qrUrl} alt="QR kód na provozní aplikaci" width={220} height={220} className="h-[220px] w-[220px]" />
        </div>
        <p className="break-all text-center text-xs text-black/50">{appUrl}</p>
        <Button type="button" variant="outline" className="w-full" onClick={() => void copyLink()}>
          {copied ? 'Zkopírováno' : 'Kopírovat odkaz'}
        </Button>
      </section>

      <section className="space-y-3 border border-black/10 p-4 text-sm">
        <h3 className="font-medium">iPhone (Safari)</h3>
        <ol className="list-decimal space-y-1 pl-5 text-black/70">
          <li>Otevřete odkaz výše v Safari.</li>
          <li>Přihlaste se.</li>
          <li>Sdílet → „Přidat na plochu“ → Přidat.</li>
        </ol>
      </section>

      <section className="space-y-3 border border-black/10 p-4 text-sm">
        <h3 className="font-medium">Android (Chrome)</h3>
        <ol className="list-decimal space-y-1 pl-5 text-black/70">
          <li>Otevřete odkaz v Chrome.</li>
          <li>Přihlaste se.</li>
          <li>Menu (⋮) → „Nainstalovat aplikaci“ / „Přidat na plochu“.</li>
        </ol>
      </section>

      <p className="text-xs text-black/50">
        Správa dodavatelů a šablon mailů zůstává na webu v záložce Dodavatelé.
      </p>
    </div>
  );
}
