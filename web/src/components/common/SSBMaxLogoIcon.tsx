import React from 'react';

export interface SSBMaxLogoIconProps {
  className?: string;
  size?: number;
}

export const SSBMaxLogoIcon: React.FC<SSBMaxLogoIconProps> = ({ className = "w-5 h-5", size }) => {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      aria-label="SSBMax Logo"
    >
      {/* Outer Shield Outline */}
      <path
        d="M50 8L82 22V48C82 70 50 92 50 92C50 92 18 70 18 48V22L50 8Z"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Inner Stylized Star Emblem */}
      <path
        d="M50 26L57.5 41H73L60.5 50.5L65.5 66L50 56.5L34.5 66L39.5 50.5L27 41H42.5L50 26Z"
        fill="currentColor"
      />
    </svg>
  );
};

export default SSBMaxLogoIcon;
