import { useLayoutEffect } from 'react';
import type { StartupHomeFrameTiming } from './StartupHomeFrameTiming';

export function useStartupHomeFrameTiming(
  timing: StartupHomeFrameTiming | undefined,
  homeVisible: boolean
): void {
  useLayoutEffect(() => timing?.onCommittedHomeFrame(homeVisible), [timing, homeVisible]);
}
