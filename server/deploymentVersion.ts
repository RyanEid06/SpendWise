/** Public provenance only. Never echo an arbitrary environment value. */
export function deploymentVersion(env: NodeJS.ProcessEnv = process.env): string {
  const commit = env.RENDER_GIT_COMMIT;
  if (!commit) return env.RENDER === 'true' ? 'unknown' : 'local';
  return /^[a-f0-9]{40}$/i.test(commit) ? commit.slice(0, 12).toLowerCase() : 'unknown';
}
