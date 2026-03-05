import React from 'react';

export default function Logo({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 100 100" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer Dark Border */}
      <path 
        d="M50 0 L95 26 L95 74 L50 100 L5 74 L5 26 Z" 
        fill="#2B2B2B" 
        id="logo-outer-border"
      />
      
      {/* White Border */}
      <path 
        d="M50 4 L91 28 L91 72 L50 96 L9 72 L9 28 Z" 
        fill="white" 
        id="logo-white-border"
      />

      {/* Content Area */}
      <g id="logo-content">
        {/* Green Part (N) */}
        <path 
          d="M29 20.7 L50 8.5 L86 29.5 V70.5 L71 79.3 V38 L50 26 V74 L29 62 Z" 
          fill="#009245" 
          id="logo-green-part"
        />
        
        {/* Red Part (U) */}
        <path 
          d="M14 29.5 V70.5 L50 91.5 L71 79.3 V38 L50 26 V74 L29 62 V20.7 Z" 
          fill="#E32124" 
          id="logo-red-part"
        />

        {/* Yellow Separator */}
        <path 
          d="M29 20.7 V62 L50 74 V26 L71 38 V79.3" 
          fill="none" 
          stroke="#FFF200" 
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          id="logo-yellow-separator"
        />
      </g>
    </svg>
  );
}
