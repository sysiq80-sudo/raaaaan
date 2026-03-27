import React from "react";

interface AppLogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

const AppLogo: React.FC<AppLogoProps> = ({ className, ...props }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 28"
      className={className}
      {...props}
    >
      <text
        x="50"
        y="20"
        fontFamily="Arial, sans-serif"
        fontSize="24"
        fontWeight="bold"
        fill="currentColor"
        textAnchor="middle"
      >
        RAAN
      </text>
    </svg>
  );
};

export default AppLogo;
