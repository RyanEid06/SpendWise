import { useEffect, useRef, useSyncExternalStore } from 'react';
import { AiOperationController } from './aiOperation';

export function useAiOperation() {
  const ref = useRef<AiOperationController | null>(null);
  if (!ref.current) ref.current = new AiOperationController();
  const operation = ref.current;
  const progress = useSyncExternalStore(operation.subscribe, operation.getSnapshot);
  useEffect(() => () => operation.reset(), [operation]);
  return { operation, progress };
}
