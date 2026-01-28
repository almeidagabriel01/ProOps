"use client";

import { ReactNode } from "react";

interface ScrollStackItemProps {
  children: ReactNode;
  index: number;
  total: number;
}

export const ScrollStackItem = ({ children, index }: ScrollStackItemProps) => {
  // Each card sticks more centered in viewport
  const topOffset = `calc(25vh + ${index * 30}px)`;

  return (
    <div
      className="sticky"
      style={{
        top: topOffset,
        zIndex: index + 1,
        // All cards need same margin to stack properly
        marginBottom: "40vh",
      }}
    >
      {children}
    </div>
  );
};

interface ScrollStackProps {
  children: ReactNode;
  className?: string;
}

const ScrollStack = ({ children, className = "" }: ScrollStackProps) => {
  return (
    <div className={`relative ${className}`}>
      {children}
      {/* Spacer controls when section ends - enough for last card to stick briefly */}
      <div style={{ height: "20vh" }} />
    </div>
  );
};

export default ScrollStack;
