import React from 'react';

type HeadingProps = {
  tag?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  children: React.ReactNode;
  className?: string;
};

export function Heading({ tag: Tag = 'h2', children, className = '' }: HeadingProps) {
  const baseStyles: Record<string, string> = {
    h1: 'text-3xl font-bold tracking-tight',
    h2: 'text-2xl font-semibold tracking-tight',
    h3: 'text-xl font-semibold',
    h4: 'text-lg font-medium',
    h5: 'text-base font-medium',
    h6: 'text-sm font-medium',
  };
  return <Tag className={`${baseStyles[Tag] || ''} ${className}`}>{children}</Tag>;
}