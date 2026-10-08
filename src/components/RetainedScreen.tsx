import React, { useState } from 'react';

/** Visit lazily, then keep screen-owned state/work alive during tab navigation. */
export function RetainedScreen({ active, children }: { active: boolean; children: React.ReactNode }) {
  const [visited, setVisited] = useState(active);
  if (active && !visited) setVisited(true);
  if (!active && !visited) return null;
  return <div hidden={!active}>{children}</div>;
}
