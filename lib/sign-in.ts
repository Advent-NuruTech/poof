import { signInWithPopup, signInWithRedirect } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

export function signInWithGoogle() {
  const isMobile = typeof window !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  return isMobile ? signInWithRedirect(auth, googleProvider) : signInWithPopup(auth, googleProvider);
}
