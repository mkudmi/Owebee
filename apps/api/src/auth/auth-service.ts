import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Database } from "../database/database.js";
import { createSessionToken, hashSessionToken } from "./session.js";

const registerInputSchema = z.object({
  email: z.string().email(),
  displayName: z.string().trim().min(1),
  locale: z.enum(["ru", "en"]).default("ru")
});

export interface RegisterResult {
  user: {
    id: string;
    email: string;
    displayName: string;
    locale: "ru" | "en";
  };
  sessionToken: string;
}

export class DuplicateEmailError extends Error {
  constructor() {
    super("Email is already registered");
  }
}

export class InvalidSessionError extends Error {
  constructor() {
    super("Session is invalid or expired");
  }
}

export class AuthService {
  constructor(private readonly database: Database) {}

  async register(input: unknown): Promise<RegisterResult> {
    const parsed = registerInputSchema.parse(input);
    const email = parsed.email.trim().toLowerCase();
    const userId = randomUUID();
    const sessionId = randomUUID();
    const sessionToken = createSessionToken();
    const sessionHash = hashSessionToken(sessionToken);

    try {
      await this.database.query("begin");
      await this.database.query(
        `
          insert into users (id, email, display_name, locale)
          values ($1, $2, $3, $4)
        `,
        [userId, email, parsed.displayName.trim(), parsed.locale]
      );
      await this.database.query(
        `
          insert into auth_sessions (id, user_id, session_hash, expires_at)
          values ($1, $2, $3, now() + interval '30 days')
        `,
        [sessionId, userId, sessionHash]
      );
      await this.database.query("commit");
    } catch (error) {
      await this.database.query("rollback").catch(() => undefined);

      if (isUniqueConstraintError(error)) {
        throw new DuplicateEmailError();
      }

      throw error;
    }

    return {
      user: {
        id: userId,
        email,
        displayName: parsed.displayName.trim(),
        locale: parsed.locale
      },
      sessionToken
    };
  }

  async getUserBySessionToken(token: string) {
    const sessionHash = hashSessionToken(token);
    const result = await this.database.query<{
      id: string;
      email: string;
      display_name: string;
      locale: "ru" | "en";
    }>(
      `
        select users.id, users.email, users.display_name, users.locale
        from auth_sessions
        join users on users.id = auth_sessions.user_id
        where auth_sessions.session_hash = $1
          and auth_sessions.revoked_at is null
          and auth_sessions.expires_at > now()
          and users.status = 'active'
        limit 1
      `,
      [sessionHash]
    );

    const user = result.rows[0];
    if (!user) {
      throw new InvalidSessionError();
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      locale: user.locale
    };
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    String(error.message).toLowerCase().includes("unique")
  );
}

