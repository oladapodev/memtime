// This file contains intentional issues that ForkBot should detect in a PR review

import { cache } from './cache-service';
import { auth } from './auth-service';

export async function authenticateUser(token) {
  // BUG 1: Cached auth can bypass revocation
  const session = await cache.get(`session:${token}`);
  if (session) {
    return session;
  }
  
  const verified = await auth.verify(token);
  await cache.set(`session:${token}`, verified, { ttl: 86400 });
  
  // BUG 2: Logging the token — secret exposure
  console.log(`User authenticated with token: ${token}`);
  
  return verified;
}
