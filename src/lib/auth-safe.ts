import { auth } from "@/auth";

export async function safeAuth() {
  try {
    return await auth();
  } catch (err) {
    console.warn("Auth session decode failed:", err);
    return null;
  }
}
