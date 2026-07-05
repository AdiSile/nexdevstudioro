import React from 'react';

type TextProps = {
  tag?: 'p' | 'span' | 'label';
  children: React.ReactNode;
  className?: string;
  muted?: boolean;
  size?: 'sm' | 'base' | 'lg';
};

export function Text({ tag: Tag = 'p', children, className = '', muted = false, size = 'base' }: TextProps) {
  const sizeClass = { sm: 'text-sm', base: 'text-base', lg: 'text-lg' }[size] || 'text-base';
  const mutedClass = muted ? 'text-gray-500' : '';
  return <Tag className={`${sizeClass} ${mutedClass} ${className}`}>{children}</Tag>;
}