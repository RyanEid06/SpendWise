import React from 'react';

interface SpendWiseLogoProps {
  className?: string;
  decorative?: boolean;
}

export const SpendWiseLogo: React.FC<SpendWiseLogoProps> = ({
  className = '',
  decorative = true,
}) => {
  const accessibility = decorative
    ? { alt: '', 'aria-hidden': true as const }
    : { alt: 'SpendWise' };

  return (
    <span className={`inline-flex shrink-0 ${className}`}>
      <img
        src="/spendwise-logo-light.png"
        {...accessibility}
        className="block h-full w-full object-contain dark:hidden"
      />
      <img
        src="/spendwise-logo-dark.png"
        {...accessibility}
        className="hidden h-full w-full object-contain dark:block"
      />
    </span>
  );
};
