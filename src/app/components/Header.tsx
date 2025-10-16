import React from "react";

type HeaderProps = {
  name?: string;
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
};

const Header = ({ name, title, subtitle, children }: HeaderProps) => {
  const displayTitle = title || name;
  
  return (
    <div className="flex justify-between items-start mb-6">
      <div>
        {displayTitle && <h1 className="text-2xl font-semibold text-gray-700">{displayTitle}</h1>}
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {children && <div className="flex gap-2">{children}</div>}
    </div>
  );
};

export default Header;
