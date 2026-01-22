interface LPLogoProps {
  className?: string;
  size?: number;
}

export function LPLogo({ className = "", size = 32 }: LPLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Golden chevron pointing down */}
      <polygon
        points="10,25 50,65 90,25 90,40 50,80 10,40"
        fill="#C4A962"
      />
    </svg>
  );
}
