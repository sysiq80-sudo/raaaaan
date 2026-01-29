/**
 * ران - Layout للراكب
 * Wrapper component لجميع صفحات الراكب مع شريط التنقل السفلي
 */

import React from "react";
import RiderBottomNav from "./RiderBottomNav";

interface RiderLayoutProps {
  children: React.ReactNode;
}

const RiderLayout: React.FC<RiderLayoutProps> = ({ children }) => {
  return (
    <>
      {children}
      <RiderBottomNav />
    </>
  );
};

export default RiderLayout;
