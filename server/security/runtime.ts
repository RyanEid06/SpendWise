import { serverConfig } from '../config';
import {
  FileInstallationRegistry,
  InstallationAuthService,
} from './installationAuth';
import { createPostgresRegistry } from './postgresInstallationRegistry';

export const installationRegistry = serverConfig.authStore === 'postgres'
  ? createPostgresRegistry(serverConfig.authDatabaseUrl!)
  : new FileInstallationRegistry(serverConfig.installationStorePath);

export const installationAuthService = new InstallationAuthService(
  installationRegistry,
  {
    challengeTtlMs: serverConfig.authChallengeTtlMs,
    accessTokenTtlMs: serverConfig.accessTokenTtlMs,
    deniedInstallationIds: serverConfig.deniedInstallationIds,
  }
);
