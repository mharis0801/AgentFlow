"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings, User, Bot } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/firebase";
import { useToast } from "@/hooks/use-toast";

export default function AppHeader() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
      });
      router.push("/signin"); // Redirect to sign-in page after sign out
    } catch (error) {
      console.error("Error signing out: ", error);
      toast({
        title: "Error Signing Out",
        description: "Could not sign out. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Function to get initials from display name
  const getInitials = (name: string | null | undefined): string => {
    if (!name) return "U"; // Default to 'U' if no name
    const names = name.split(' ');
    if (names.length === 1) return names[0][0].toUpperCase();
    return (names[0][0] + names[names.length - 1][0]).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 sm:py-4">
       <div className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-primary">
           <Bot className="h-6 w-6 text-primary" />
           <span className="hidden sm:inline-block">AgentFlow</span>
        </Link>
       </div>

      <div className="ml-auto flex items-center gap-4">
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost" // Changed variant for better appearance
                size="icon"
                className="overflow-hidden rounded-full border-2 border-primary/50 hover:border-primary transition-colors"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.photoURL || undefined} alt={user.displayName || "User Avatar"} />
                  <AvatarFallback className="bg-muted text-muted-foreground font-semibold">
                    {getInitials(user.displayName)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                 <div className="font-semibold">{user.displayName || "User"}</div>
                 <div className="text-xs text-muted-foreground">{user.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {/* <DropdownMenuItem disabled> // Profile/Settings could be added later
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator /> */}
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          // Sign in/up buttons are shown on their respective pages now
          // This section can be removed or used for other header items if needed
          null
        )}
      </div>
    </header>
  );
}
