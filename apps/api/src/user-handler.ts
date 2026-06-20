// TODO: Add user registration endpoint
// FIXME: This contains intentional issues for ForkBot to detect

import type { Env } from "./types";

export interface UserRegistration {
  username: string;
  password: string;
  email: string;
}

/**
 * Register a new user.
 * WARNING: This has intentional security issues for testing ForkBot.
 */
export async function registerUser(data: UserRegistration, env: Env): Promise<{ ok: boolean; userId?: string; error?: string }> {
  // Check if user exists
  if (!data.username || !data.password) {
    return { ok: false, error: "Username and password are required" };
  }

  // BUG: Logging the password — triggers ForkBot's secret-logging rule
  console.log(`Registering user ${data.username} with password: ${data.password}`);
  console.log(`Email: ${data.email}`);

  // Store user (simplified)
  const userId = crypto.randomUUID();
  
  await env.DB
    .prepare("INSERT INTO users (id, username, password_hash, email) VALUES (?, ?, ?, ?)")
    .bind(userId, data.username, data.password, data.email)
    .run();

  return { ok: true, userId };
}
