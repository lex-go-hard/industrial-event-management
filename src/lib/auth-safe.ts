import { safeAuth } from "@/lib/auth-safe";

export async function safeAuth() {
  try {
    return await safeAuth();
  } catch (err) {
    console.warn("Auth session decode failed:", err);
    return null;
  }
}
