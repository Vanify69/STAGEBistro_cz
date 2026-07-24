import { useMemo, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { usePermissions } from '@/lib/usePermissions';
import { canAccessProvoz } from '@/lib/permissions';

const ANDROID_APK_URL = '/downloads/stage-provoz.apk';

function getProvozAppUrl(): string {
  const fromEnv = (import.meta.env.VITE_PROVOZ_APP_URL as string | undefined)?.trim();
  if (fromEnv) {
    const withScheme = /^https?:\/\//i.test(fromEnv) ? fromEnv : `https://${fromEnv}`;
    return withScheme.replace(/\/$/, '');
  }
  if (import.meta.env.DEV) return 'http://localhost:5174';
  return 'https://app.stagebistro.cz';
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
            Interní appka na objednávky surovin a focení účtenek. Není v App Store / Google Play —
            instaluje se přímo odsud.
          </p>
        </div>
        <Button type="button" className="h-12 w-full" asChild>
          <a href={appUrl} target="_blank" rel="noreferrer">
            Otevřít v prohlížeči
          </a>
        </Button>
      </section>

      <section className="space-y-3 border border-black/10 p-4">
        <h3 className="font-medium">Android — stáhnout APK</h3>
        <p className="text-sm text-black/60">
          Doporučená cesta pro telefony s Androidem: nainstalujete klasickou aplikaci (ikona bez
          odznaku Chrome).
        </p>
        <Button type="button" className="h-12 w-full" asChild>
          <a href={ANDROID_APK_URL} download="stage-provoz.apk">
            Stáhnout Provoz.apk
          </a>
        </Button>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-black/70">
          <li>Stáhněte soubor výše (nebo z QR / odkazu na této stránce v telefonu).</li>
          <li>Otevřete stažený soubor a potvrďte instalaci.</li>
          <li>
            Pokud Android blokuje instalaci, povolte u prohlížeče „Instalovat neznámé aplikace“.
          </li>
          <li>Otevřete appku <strong>Provoz</strong> a přihlaste se.</li>
        </ol>
      </section>

      <section className="space-y-3 border border-black/10 p-4">
        <h3 className="font-medium">QR kód / odkaz (webová appka)</h3>
        <p className="text-sm text-black/60">
          {platform === 'desktop'
            ? 'Pro iPhone naskenujte QR. Na Androidu raději stáhněte APK výše.'
            : platform === 'android'
              ? 'Na Androidu preferujte stažení APK výše. Odkaz níže je záložní webová verze.'
              : 'Na iPhonu otevřete odkaz v Safari a přidejte na plochu.'}
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
          <li>Otevřete odkaz výše v Safari (ne v Chrome).</li>
          <li>Přihlaste se.</li>
          <li>Sdílet → „Přidat na plochu“ → Přidat.</li>
        </ol>
        <p className="text-xs text-black/50">
          Apple neumožňuje volně stahovat IPA z webu bez App Store — na iPhonu zůstává PWA.
        </p>
      </section>

      <p className="text-xs text-black/50">
        Správa dodavatelů a šablon mailů zůstává na webu v záložce Dodavatelé.
      </p>
    </div>
  );
}
