/**
 * ران - Layout للسائق
 * Wrapper component لجميع صفحات السائق مع شريط التنقل السفلي
 */

import React from "react";
import DriverBottomNav from "./DriverBottomNav";

interface DriverLayoutProps {
  children: React.ReactNode;
}

const DriverLayout: React.FC<DriverLayoutProps> = ({ children }) => {
  return (
    <>
      {children}
      {/* <DriverBottomNav /> — مخفية مؤقتاً */}
    </>
  );
};

export default DriverLayout;
