# Stage Provoz — Android APK (interní)

APK je Trusted Web Activity (PWABuilder / Bubblewrap) nad `https://app.stagebistro.cz`.
Není v Google Play — zaměstnanci ho stahují z webu (**Provoz → Aplikace**).

## Soubory

| Cesta | Účel |
|-------|------|
| `../public/downloads/stage-provoz.apk` | Soubor ke stažení z produkčního webu |
| `dist/stage-provoz.apk` | Kopie pro archiv |
| `signing/signing.keystore` | Podpisový klíč (uchovej — bez něj nejde aktualizovat stejnou appku) |
| `signing/signing-key-info.txt` | Hesla ke keystore |
| `pwabuilder-options.json` | Parametry pro znovusestavení přes PWABuilder API |
| `../provoz-app/public/.well-known/assetlinks.json` | Digital Asset Links (schová adresní řádek v TWA) |

Package ID: `cz.stagebistro.provoz`

## Znovu sestavit APK

```bash
curl -X POST "https://pwabuilder-cloudapk.azurewebsites.net/generateAppPackage" \
  -H "Content-Type: application/json" \
  --data-binary "@pwabuilder-options.json" \
  -o provo-apk.zip
```

Pro stejný balíček při aktualizaci použij `signingMode: "mine"` a base64 keystore (viz PWABuilder docs),
nebo znovu `signingMode: "new"` — pak ale musíš přeinstalovat appku (jiný podpis).

Po sestavení:

1. Zkopíruj `.apk` do `public/downloads/stage-provoz.apk`
2. Aktualizuj `assetlinks.json` fingerprint, pokud se změnil signing key
3. Redeploy **Web** i **APP** (`provoz-app`, kvůli assetlinks)

## Instalace na telefonu

1. Stáhnout APK z Provoz → Aplikace
2. Povolit instalaci neznámých aplikací pro prohlížeč
3. Nainstalovat → otevřít **Provoz**
