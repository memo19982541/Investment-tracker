import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
].join(" ");

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
          scope: SCOPES,
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      if (ALLOWED_EMAILS.length === 0) return true;
      return ALLOWED_EMAILS.includes(user.email.toLowerCase());
    },
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at ?? undefined;
        token.error = undefined;

        // One-time setup helper for the scheduled price-fetch cron job,
        // which has no browser session and needs a long-lived refresh token
        // instead. Printed only to this server's own terminal — never to
        // the browser — and only when explicitly opted into. Turn back off
        // (remove the env var) once you've copied the token into
        // GOOGLE_REFRESH_TOKEN.
        if (process.env.DEBUG_PRINT_REFRESH_TOKEN === "true" && account.refresh_token) {
          console.log(
            "\n[DEBUG_PRINT_REFRESH_TOKEN] Google refresh token (copy into GOOGLE_REFRESH_TOKEN in .env.local, then remove this env var):\n" +
              account.refresh_token +
              "\n"
          );
        }

        return token;
      }

      if (
        token.expiresAt &&
        Date.now() < token.expiresAt * 1000 - 60_000
      ) {
        return token;
      }

      if (!token.refreshToken) {
        return token;
      }

      try {
        const response = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.AUTH_GOOGLE_ID!,
            client_secret: process.env.AUTH_GOOGLE_SECRET!,
            grant_type: "refresh_token",
            refresh_token: token.refreshToken,
          }),
        });
        const refreshed = await response.json();
        if (!response.ok) throw refreshed;

        token.accessToken = refreshed.access_token;
        token.expiresAt = Math.floor(Date.now() / 1000) + refreshed.expires_in;
        if (refreshed.refresh_token) token.refreshToken = refreshed.refresh_token;
        token.error = undefined;
      } catch (err) {
        console.error("Failed to refresh Google access token", err);
        token.error = "RefreshAccessTokenError";
      }

      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      return session;
    },
  },
});
