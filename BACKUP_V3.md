# SpendWise Backup v3

WP30 implements the default portable SpendWise backup as an authenticated encrypted envelope.

## Envelope

Binary layout:

```text
0..3   magic "SWB3"
4      format version = 3
5..8   big-endian authenticated-header byte length
9..N   UTF-8 JSON authenticated header (AES-GCM AAD)
N..EOF AES-256-GCM ciphertext followed by the 128-bit authentication tag
```

The authenticated header contains:

- format and header versions;
- Argon2id algorithm and parameter version;
- Argon2id memory, iterations, parallelism and output length;
- a fresh 16-byte random salt;
- AES-256-GCM algorithm identifier;
- a fresh 12-byte random nonce;
- 128-bit tag length;
- logical payload format;
- data-only vs data+photos mode;
- plaintext payload byte count.

The ciphertext contains a logical Backup v2 ZIP payload. It never contains or reuses SQLCipher database ciphertext, WP29 media ciphertext, DB keys, media keys, App Lock credentials or Android Keystore material.

## KDF policy

KDF parameter version 1 uses:

- Argon2id;
- 19,456 KiB memory;
- 2 iterations;
- parallelism 1;
- 32-byte output;
- 16-byte fresh random salt.

Restore validates KDF parameters before running Argon2. Accepted v1 bounds prevent a malicious header from requesting unbounded work:

- memory: 16 MiB through 64 MiB;
- iterations: 2 through 4;
- parallelism: 1 through 2;
- output: exactly 32 bytes.

The passphrase and derived key are never persisted. SpendWise cannot recover a forgotten Backup v3 passphrase.

## Restore order

Backup v3 restore follows this order:

1. bound outer envelope size;
2. validate magic, version and header length;
3. validate KDF/cipher parameters;
4. derive the one-backup key with Argon2id;
5. authenticate/decrypt with AES-256-GCM using the exact header bytes as AAD;
6. validate the inner ZIP central directory before inflation;
7. validate Backup v2 manifest/schema, ledger invariants, currency rules and attachment mappings;
8. validate media limits/checksums and JPEG boundary markers for v3 media;
9. stage replacement media;
10. validate the complete candidate financial state;
11. commit the candidate state;
12. apply replacement settings where applicable;
13. clean old media only after successful commit.

Wrong passphrases, authentication failures, malformed/truncated envelopes and invalid payloads fail before active-ledger mutation. If a mutation-phase failure occurs, the existing Backup v2 restore transaction restores the previous state and removes staged media where rollback succeeds.

## Compatibility

- Backup v1 JSON: import remains supported.
- Backup v2 ZIP data-only: import remains supported.
- Backup v2 ZIP data + photos: import remains supported.
- Backup v3: default export and supported import.
- CSV: intentionally plaintext; Settings warns that exported financial data can be read outside SpendWise.

## Malicious-input limits

WP30 validates ZIP structure from the central directory before JSZip inflation. It rejects:

- multi-disk/ZIP64 structures outside the supported format;
- unsupported compression methods or encrypted ZIP entries;
- excessive entry counts;
- path traversal, absolute paths and unexpected paths;
- duplicate paths;
- oversized manifest/media entries;
- excessive aggregate uncompressed size;
- duplicate attachment IDs/storage mappings;
- unsupported MIME types;
- more than eight photos per expense;
- malformed manifests;
- corrupted v3 JPEG payloads.

The existing 512 MiB Backup v2 payload ceiling remains the upper compatibility bound; per-media payloads remain capped at 5 MiB.
