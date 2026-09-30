import { serverConfig } from '../config';
import {
  FileInstallationRegistry,
  InstallationAuthService,
} from './installationAuth';

export const installationRegistry = new FileInstallationRegistry(
  serverConfig.installationStorePath
);

export const installationAuthService = new InstallationAuthService(
  installationRegistry,
  {
    challengeTtlMs: serverConfig.authChallengeTtlMs,
    accessTokenTtlMs: serverConfig.accessTokenTtlMs,
    deniedInstallationIds: serverConfig.deniedInstallationIds,
  }
);
