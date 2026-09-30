import {
  createSign,
  generateKeyPairSync,
} from 'node:crypto';

const rawBaseUrl = (process.env.VITE_API_BASE_URL || '').trim();
if (!rawBaseUrl) {
  console.error('Missing VITE_API_BASE_URL for deployed authentication smoke.');
  process.exit(1);
}
const baseUrl = rawBaseUrl.replace(/\/$/, '');
if (!/^https:\/\//i.test(baseUrl)) {
  console.error('Deployed authentication smoke requires an HTTPS API URL.');
  process.exit(1);
}

async function post(path, body, headers = {}) {
  const response = await fetch(baseUrl + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });
  let json = {};
  try {
    json = await response.json();
  } catch {}
  if (!response.ok) {
    throw new Error(
      path + ' failed with HTTP ' + response.status + ' / ' +
      String(json.error || 'UNKNOWN')
    );
  }
  return json;
}

const healthResponse = await fetch(baseUrl + '/api/health', {
  signal: AbortSignal.timeout(30_000),
});
const health = await healthResponse.json();
if (
  !healthResponse.ok ||
  health.ok !== true ||
  health.aiConfigured !== true ||
  health.authentication !== 'installation-signature-v1'
) {
  throw new Error('Deployed backend is not ready for installation authentication.');
}

const { publicKey, privateKey } = generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
});
const publicKeyBase64 = publicKey
  .export({ type: 'spki', format: 'der' })
  .toString('base64');

const registration = await post('/api/auth/register', {
  algorithm: 'ECDSA_P256_SHA256',
  publicKey: publicKeyBase64,
});
const challenge = await post('/api/auth/challenge', {
  installationId: registration.installationId,
});
const signer = createSign('SHA256');
signer.update(challenge.payload);
signer.end();
const signature = signer.sign(privateKey).toString('base64');

const session = await post('/api/auth/verify', {
  installationId: registration.installationId,
  challengeId: challenge.challengeId,
  signature,
});

const analysis = await post(
  '/api/gemini/analyze',
  {
    summary: {
      totalMonthsRecorded: 0,
      historicalMonthlyAverage: 0,
      currentMonthKey: '2026-09',
      currentMonthTotal: 0,
      previousMonthTotal: null,
      categoryBaselines: [],
      currentMonthExpenses: [],
      recurringCandidates: [],
    },
    currencyCode: 'USD',
    language: 'en',
  },
  { Authorization: 'Bearer ' + session.accessToken }
);

if (
  analysis.isAiGenerated !== true ||
  typeof analysis.spendingOverview !== 'string'
) {
  throw new Error('Gemini smoke returned an invalid response.');
}

console.log('Deployed installation-authenticated Gemini smoke passed.');
