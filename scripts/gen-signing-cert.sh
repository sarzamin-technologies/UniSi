#!/usr/bin/env bash
#
# Generate a self-signed PKCS#12 certificate for PAdES-signing the audit trail.
# FOR LOCAL DEVELOPMENT ONLY — production must use a certificate from a real CA
# (or an organization cert) so readers trust the signature without manual setup.
#
# Usage: ./scripts/gen-signing-cert.sh [output-dir] [passphrase]
set -euo pipefail

OUT_DIR="${1:-$(cd "$(dirname "$0")/.." && pwd)/certs}"
PASS="${2:-changeit}"
mkdir -p "$OUT_DIR"

KEY="$OUT_DIR/platform-signing.key.pem"
CRT="$OUT_DIR/platform-signing.cert.pem"
P12="$OUT_DIR/platform-signing.p12"

openssl req -x509 -newkey rsa:2048 -keyout "$KEY" -out "$CRT" \
  -days 3650 -nodes -subj "/CN=UniSi Platform/O=UniSi/OU=Signing"

openssl pkcs12 -export -out "$P12" -inkey "$KEY" -in "$CRT" \
  -name "UniSi Platform" -passout "pass:$PASS"

rm -f "$KEY" "$CRT"

echo ""
echo "Wrote $P12"
echo "Add to your .env:"
echo "  PLATFORM_SIGN_P12_PATH=$P12"
echo "  PLATFORM_SIGN_P12_PASSPHRASE=$PASS"
