// HTTPS certificate-pinned fetch wrapper.
//
// WHY: HTTPS alone trusts whatever CA is in the device's trust store. On
// hostile networks (corporate proxies, public Wi-Fi with captive portals,
// devices with attacker-installed CAs) that lets a MITM observe and modify
// our API traffic — including JWTs in flight. Pinning the server's public
// key SHA-256 means the client refuses to talk to anything that doesn't
// present our exact certificate.
//
// HOW THIS WORKS:
//   - In Expo Go: native cert pinning isn't available, so we fall back to
//     plain `fetch`. This is acceptable for development; the production
//     build (custom dev client / EAS Build) will use the pinned path.
//   - In a custom build: requires `react-native-ssl-pinning`. After you add
//     it, run a custom dev client or EAS Build (Expo Go can't load it).
//
// BEFORE SHIPPING TO PRODUCTION — DO THIS:
//   1. Get the SHA-256 pin of your production cert. Run, on any machine:
//        openssl s_client -servername api.your-domain -connect api.your-domain:443 \
//          | openssl x509 -pubkey -noout \
//          | openssl pkey -pubin -outform DER \
//          | openssl dgst -sha256 -binary \
//          | openssl enc -base64
//      Copy the resulting base64 string into PRIMARY_PIN below.
//
//   2. Get a BACKUP_PIN — generate a CSR for your next cert ahead of time
//      so when the current cert rotates, clients with the old app version
//      still validate against the backup. Without a backup, certificate
//      rotation requires a forced app update.
//
//   3. Add the dependency:
//        npm install react-native-ssl-pinning --legacy-peer-deps
//      Then build a custom dev client (npx expo run:android / EAS Build) —
//      Expo Go cannot load native modules.
//
//   4. Set ENABLE_PINNING = true below.

const ENABLE_PINNING = false; // flip to true after steps 1–3 above

// SHA-256 of the SubjectPublicKeyInfo, base64-encoded. NOT the cert hash.
const PRIMARY_PIN = "REPLACE_WITH_PROD_CERT_SPKI_SHA256";
const BACKUP_PIN  = "REPLACE_WITH_BACKUP_CERT_SPKI_SHA256";

// Hostnames whose responses must match a pin. Requests to other hosts (e.g.
// Google Maps tile servers) are intentionally NOT pinned.
const PINNED_HOSTS = [
    "dspmain-production.up.railway.app",
    "dspidentity-production-74ae.up.railway.app",
];

function shouldPin(url) {
    if (!ENABLE_PINNING) return false;
    try {
        const host = new URL(url).hostname;
        return PINNED_HOSTS.includes(host);
    } catch {
        return false;
    }
}

// Lazy require so projects without react-native-ssl-pinning installed (e.g.
// running in Expo Go) don't crash at import time.
let pinnedFetcher = null;
function getPinnedFetcher() {
    if (pinnedFetcher) return pinnedFetcher;
    try {
        const lib = require("react-native-ssl-pinning");
        pinnedFetcher = lib.fetch || lib.default?.fetch;
    } catch {
        pinnedFetcher = null;
    }
    return pinnedFetcher;
}

export async function securedFetch(url, options = {}) {
    if (!shouldPin(url)) {
        return fetch(url, options);
    }

    const pinned = getPinnedFetcher();
    if (!pinned) {
        if (__DEV__) {
            // eslint-disable-next-line no-console
            console.warn(
                "[securedFetch] Pinning enabled but react-native-ssl-pinning is " +
                "not available — falling back to plain fetch. This is fine in " +
                "Expo Go but MUST NOT happen in a production build.",
            );
        }
        return fetch(url, options);
    }

    // react-native-ssl-pinning's API: fetch(url, { method, headers, body, sslPinning: { certs: [...] } })
    return pinned(url, {
        ...options,
        sslPinning: {
            // For the public-key-hash strategy, the lib expects base64 SPKI
            // hashes. Bundling cert files (.cer) in /android/app/src/main/assets
            // is the alternative; either works.
            certs: [PRIMARY_PIN, BACKUP_PIN],
        },
        timeoutInterval: 30000,
    });
}
