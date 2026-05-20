import { createHash, createHmac, timingSafeEqual as timingSafeEqualNode } from "node:crypto";

export const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

export const hmacSha256 = (secret: string, payload: string): string =>
  createHmac("sha256", secret).update(payload).digest("hex");

export const timingSafeEqual = (a: string, b: string): boolean => {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) {
    return false;
  }
  return timingSafeEqualNode(aBuffer, bBuffer);
};
