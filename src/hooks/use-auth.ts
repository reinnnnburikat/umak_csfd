"use client";

// Re-export from the new session provider for backward compatibility.
// All client components that import from '@/hooks/use-auth' will work unchanged.
export { useAuth, SessionProvider, type AuthUser } from "@/components/providers/session-provider";
