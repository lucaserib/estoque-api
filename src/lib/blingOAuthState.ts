import crypto from "crypto";
import { obterSegredoAuth } from "@/lib/authSecret";

const COOKIE_NAME = "bling_oauth_state";
const COOKIE_MAX_AGE_SECONDS = 10 * 60;

function sign(state: string, userId: string): string {
  const segredo = obterSegredoAuth();
  if (!segredo) {
    throw new Error("NEXTAUTH_SECRET/AUTH_SECRET não configurado");
  }
  return crypto
    .createHmac("sha256", segredo)
    .update(`${state}.${userId}`)
    .digest("hex");
}

export function buildBlingOAuthStateCookie(
  state: string,
  userId: string
): { name: string; value: string; maxAge: number } {
  const signature = sign(state, userId);
  return {
    name: COOKIE_NAME,
    value: `${state}.${userId}.${signature}`,
    maxAge: COOKIE_MAX_AGE_SECONDS,
  };
}

export function verifyBlingOAuthStateCookie(
  cookieValue: string | undefined,
  stateFromCallback: string,
  userIdFromSession: string
): boolean {
  if (!cookieValue) return false;

  const [state, userId, signature] = cookieValue.split(".");
  if (!state || !userId || !signature) return false;

  const expectedSignature = sign(state, userId);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) return false;
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return false;

  return state === stateFromCallback && userId === userIdFromSession;
}

export const BLING_OAUTH_STATE_COOKIE_NAME = COOKIE_NAME;
