import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compareSync } from "bcryptjs";
import { db } from "@/lib/db";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      fullName: string;
      role: string;
      profileImageUrl?: string;
      studentNumber?: string;
    };
  }
  interface User {
    id: string;
    email: string;
    fullName: string;
    role: string;
    profileImageUrl?: string;
    studentNumber?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    fullName: string;
    role: string;
    profileImageUrl?: string;
    studentNumber?: string;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        console.log("[Auth] authorize called — email:", credentials?.email, "password length:", credentials?.password?.length);

        if (!credentials?.email || !credentials?.password) {
          console.log("[Auth] missing credentials — email:", !!credentials?.email, "password:", !!credentials?.password);
          throw new Error("Email and password are required");
        }

        try {
          // Trim email to avoid whitespace issues
          const email = credentials.email.trim().toLowerCase();
          console.log("[Auth] looking up user with email:", email);

          const user = await db.user.findUnique({
            where: { email },
          });

          if (!user) {
            console.log("[Auth] no user found for email:", email);
            throw new Error("Invalid email or password");
          }

          console.log("[Auth] user found:", user.email, "role:", user.role, "status:", user.status);

          if (user.status === "deactivated") {
            console.log("[Auth] account deactivated");
            throw new Error("Your account has been deactivated. Please contact an administrator.");
          }

          const isPasswordValid = compareSync(credentials.password, user.passwordHash);
          console.log("[Auth] password check result:", isPasswordValid, "for email:", email);

          if (!isPasswordValid) {
            console.log("[Auth] invalid password for email:", email);
            throw new Error("Invalid email or password");
          }

          console.log("[Auth] login successful for:", email);

          return {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            profileImageUrl: user.profileImageUrl || undefined,
            studentNumber: user.studentNumber || undefined,
          };
        } catch (error) {
          // Re-throw known errors
          if (error instanceof Error && (
            error.message === "Invalid email or password" ||
            error.message === "Your account has been deactivated. Please contact an administrator."
          )) {
            throw error;
          }
          // Unexpected errors — log and return generic message
          console.error("[Auth] authorize error:", error);
          throw new Error("Authentication service unavailable. Please try again later.");
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.fullName = user.fullName;
        token.role = user.role;
        token.profileImageUrl = user.profileImageUrl;
        token.studentNumber = user.studentNumber;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.fullName = token.fullName as string;
        session.user.role = token.role as string;
        session.user.profileImageUrl = token.profileImageUrl as string | undefined;
        session.user.studentNumber = token.studentNumber as string | undefined;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
      },
    },
    csrfToken: {
      name: "next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
      },
    },
    callbackUrl: {
      name: "next-auth.callback-url",
      options: {
        sameSite: "lax",
        path: "/",
        secure: false,
      },
    },
  },
  debug: process.env.NODE_ENV === "development",
};
