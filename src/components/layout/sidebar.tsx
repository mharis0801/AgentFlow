
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { Mail, Calendar, Plane, Hotel, LayoutDashboard, Bot, Search } from "lucide-react"; // Added Search icon
import { cn } from "@/lib/utils";

const menuItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/schedule-email", label: "Schedule Email", icon: Mail },
  { href: "/setup-meeting", label: "Setup Meeting", icon: Calendar },
  { href: "/book-hotel", label: "Search Hotels", icon: Hotel }, // Updated label
  { href: "/book-flight", label: "Search Flights", icon: Plane }, // Updated label
];

export default function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" variant="sidebar" className="border-primary/10">
      <SidebarHeader className="border-b border-sidebar-border">
         <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-sidebar-foreground px-2">
             <Bot className="h-6 w-6" />
            <span className="group-data-[collapsible=icon]:hidden">AgentFlow</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href} legacyBehavior passHref>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href}
                  tooltip={item.label}
                  className={cn(
                      "justify-start", // Keep text left-aligned
                       "group-data-[collapsible=icon]:justify-center", // Center icon when collapsed
                       "text-sidebar-foreground/80 hover:text-sidebar-foreground", // Subtle text color
                       "hover:bg-sidebar-accent/80", // Slightly transparent hover
                       pathname === item.href && "bg-sidebar-accent text-sidebar-accent-foreground font-medium" // Active state
                  )}
                >
                    <a>
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                    </a>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      {/* Add SidebarFooter if needed */}
    </Sidebar>
  );
}

