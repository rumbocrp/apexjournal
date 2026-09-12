import React from 'react';

interface ApexLogoProps {
  size?: number;
  className?: string;
}

export const ApexLogo: React.FC<ApexLogoProps> = ({ size = 20, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      {/* Precision Geometric Monochromatic Crest */}
      <rect x="2" y="2" width="28" height="28" rx="6" fill="#141418" stroke="#2a2a32" strokeWidth="1" />
      
      {/* Structural Chevron Wings */}
      <path
        d="M 8 22 L 16 7 L 24 22 L 20.5 22 L 16 13.5 L 11.5 22 Z"
        fill="#ededef"
      />
      
      {/* Center Precision Vertex */}
      <polygon
        points="16,16 19,22 13,22"
        fill="#63636c"
      />
      
      {/* Baseline Anchor Line */}
      <line x1="10" y1="24" x2="22" y2="24" stroke="#3a3a44" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
};
