import { randomUUID } from "node:crypto";
import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "../db/client.js";
import { webhookEndpoints } from "../db/schema.js";
import { hmacSha256, timingSafeEqual } from "./crypto.js";

export const signPayload = (secret: string, payload: string): string =>
  `sha256=${hmacSha256(secret, payload)}`;

export const verifySignature = (
  secret: string,
  payload: string,
  headerValue: string | undefined,
): boolean => {
  if (!headerValue) {
    return false;
  }
  const expected = signPayload(secret, payload);
  return timingSafeEqual(expected, headerValue);
};

type EventPayload = {
  id: string;
  type: string;
  created_at: string;
  data: unknown;
  account_id: string;
};

const shouldDeliver = (
  subscribedEvents: string[] | null,
  eventType: string,
): boolean => {
  if (!subscribedEvents || subscribedEvents.length === 0) {
    return true;
  }
  return subscribedEvents.includes(eventType);
};

export const deliverEvent = async (
  accountId: string,
  inboxId: string,
  eventType: string,
  data: unknown,
): Promise<void> => {
  const endpoints = await db.query.webhookEndpoints.findMany({
    where: and(
      eq(webhookEndpoints.accountId, accountId),
      eq(webhookEndpoints.isEnabled, true),
      or(isNull(webhookEndpoints.inboxId), eq(webhookEndpoints.inboxId, inboxId)),
    ),
  });

  if (endpoints.length === 0) {
    return;
  }

  const payload: EventPayload = {
    id: randomUUID(),
    type: eventType,
    created_at: new Date().toISOString(),
    data,
    account_id: accountId,
  };
  const body = JSON.stringify(payload);

  await Promise.all(
    endpoints
      .filter((endpoint) => shouldDeliver(endpoint.subscribedEvents ?? null, eventType))
      .map(async (endpoint) => {
        const signature = signPayload(endpoint.signingSecret, body);
        try {
          await fetch(endpoint.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-RoboMail-Signature": signature,
              "X-RoboMail-Event-Id": payload.id,
              "X-RoboMail-Event-Type": payload.type,
              "X-RoboMail-Delivery-Attempt": "1",
            },
            body,
          });
        } catch (error) {
          console.error("Webhook delivery failed", {
            endpointId: endpoint.id,
            error,
          });
        }
      }),
  );
};
