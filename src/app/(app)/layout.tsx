"use client"

import React from "react";
import ProtectedRoute from "@/components/layout/protected-route";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "@/components/layout/sidebar";
import AppHeader from "@/components/layout/header";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Wrap the entire layout content with ProtectedRoute
    <ProtectedRoute>
      <SidebarProvider defaultOpen>
        <div className="flex min-h-screen w-full bg-background">
          <AppSidebar />
          <div className="flex flex-col flex-1">
            <AppHeader />
            <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </ProtectedRoute>
  );
}
