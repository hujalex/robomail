import { randomUUID } from "node:crypto";

export const normalizeEmail = (value: string): string =>
  value.trim().toLowerCase();

export const normalizeEmailList = (value: string[] | string): string[] => {
  const list = Array.isArray(value) ? value : [value];
  return list
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => entry.toLowerCase());
};

export const buildAddress = (username: string, domain: string): string =>
  `${normalizeEmail(username)}@${normalizeEmail(domain)}`;

export const extractDomain = (address: string): string => {
  const [, domain] = normalizeEmail(address).split("@");
  return domain ?? "robomail.local";
};

export const generateMessageId = (domain: string): string =>
  `<${randomUUID()}@${domain}>`;

export const generateThreadId = (): string => `thread_${randomUUID()}`;

export const normalizeMessageId = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
    return trimmed;
  }
  return `<${trimmed}>`;
};

export const splitReferences = (value?: string): string[] => {
  if (!value) {
    return [];
  }
  return value
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => normalizeMessageId(entry));
};

export const extractEmailAddress = (value: string): string => {
  const trimmed = value.trim();
  const match = trimmed.match(/<([^>]+)>/);
  return normalizeEmail(match ? match[1] : trimmed);
};

export const parseAddressList = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry) =>
      typeof entry === "string" ? entry.split(",") : [],
    );
  }
  if (typeof value === "string") return value.split(",");
  return [];
};
