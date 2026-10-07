import React, { useLayoutEffect, useRef } from 'react';

// Keep the complete formatted value readable; only reduce its font when its
// actual available width cannot hold it at the normal size.
export const SingleLineAmount: React.FC<{ value: string; className: string }> = ({ value, className }) => {
  const host = useRef<HTMLSpanElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const container = host.current;
    const content = text.current;
    if (!container || !content) return;
    let disposed = false;
    const fit = () => {
      if (disposed) return;
      content.style.fontSize = '';
      const normalSize = Number.parseFloat(getComputedStyle(container).fontSize);
      const width = content.getBoundingClientRect().width;
      if (width > container.clientWidth && container.clientWidth > 0) {
        content.style.fontSize = `${normalSize * container.clientWidth / width}px`;
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    void document.fonts.ready.then(fit);
    return () => { disposed = true; observer.disconnect(); };
  }, [value]);
  return <span ref={host} dir="ltr" data-home-amount="single-line"
    className={`block min-w-0 whitespace-nowrap ${className}`}>
    <span ref={text} className="inline-block">{value}</span>
  </span>;
};
