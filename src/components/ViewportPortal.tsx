import React from 'react';
import { createPortal } from 'react-dom';

export const ViewportPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
};
