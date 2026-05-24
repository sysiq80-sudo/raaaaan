import React from "react";

interface RootLayoutProps {
  children: React.ReactNode;
  bottom?: React.ReactNode;
  className?: string;
  mainClassName?: string;
  dir?: "rtl" | "ltr";
}

const RootLayout: React.FC<RootLayoutProps> = ({
  children,
  bottom,
  className = "",
  mainClassName = "",
  dir,
}) => {
  return (
    <div
      className={`flex flex-col h-[100dvh] w-full overflow-hidden bg-background ${className}`.trim()}
      dir={dir}
    >
      <main className={`flex-1 relative overflow-y-auto overflow-x-hidden ${mainClassName}`.trim()}>
        {children}
      </main>
      {bottom && <div className="shrink-0 z-50">{bottom}</div>}
    </div>
  );
};

export default RootLayout;
