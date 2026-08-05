import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface LayoutProps {
  children: React.ReactNode;
  selectedStrategies?: string[];
  toggleStrategy?: (id: string) => void;
}

export const DashboardLayout: React.FC<LayoutProps> = ({ children, selectedStrategies, toggleStrategy }) => {
  return (
    <div className="flex h-full w-full bg-bg-deep overflow-hidden text-text-main font-sans">
      <Sidebar selectedStrategies={selectedStrategies} toggleStrategy={toggleStrategy} />
      <div className="flex flex-col flex-1 overflow-hidden relative">

        <Header />
        <main className="flex-1 overflow-auto p-4 md:p-6 md:px-8 z-10 flex flex-col gap-6">
          {children}
        </main>
      </div>
    </div>
  );
};
