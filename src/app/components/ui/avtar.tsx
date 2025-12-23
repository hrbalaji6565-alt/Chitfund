'use client'

import React from 'react';

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
}

interface AvatarImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  className?: string;
}

interface AvatarFallbackProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children?: React.ReactNode;
}

export const Avatar: React.FC<AvatarProps> = ({ className = '', children, ...props }) => {
  return (
    <div
      className={`relative flex w-8 h-8 shrink-0 overflow-hidden rounded-full ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export const AvatarImage: React.FC<AvatarImageProps> = ({ className = '', ...props }) => {
  return (
    <img
      className={`w-full h-full object-cover ${className}`}
      {...props}
    />
  )
}

export const AvatarFallback: React.FC<AvatarFallbackProps> = ({
  className = "",
  children,
  ...props
}) => {
  return (
    <div
      style={{ background: "var(--gradient-primary)" }}
      className={`flex items-center justify-center w-full h-full rounded-full transition-all duration-300 hover:[background:var(--gradient-primary-hover)] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
