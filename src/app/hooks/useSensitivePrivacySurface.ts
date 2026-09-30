import { useEffect } from 'react';
import { secureSessionService } from '../../security/SecureSessionService';

export function useSensitivePrivacySurface(): void {
  useEffect(() => {
    secureSessionService.enterSensitiveSurface();
    return () => secureSessionService.leaveSensitiveSurface();
  }, []);
}
