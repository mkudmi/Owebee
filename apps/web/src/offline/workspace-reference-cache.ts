import type {
  CurrencyReference,
  ParticipantsPage
} from "../api/owebee-api.js";
import {
  openIndexedDatabase,
  runStoreRequest
} from "./indexed-db.js";

export interface CachedMemberReference {
  id: string;
  displayName: string;
  role: "owner" | "participant";
}

export interface CachedFamilyReference {
  id: string;
  displayName: string;
  shareCount: string;
}

export interface WorkspaceReferenceSnapshot {
  tripId: string;
  members: CachedMemberReference[];
  families: CachedFamilyReference[];
  currencies: CurrencyReference[];
  updatedAt: string;
}

export interface WorkspaceReferenceCache {
  get(tripId: string): Promise<WorkspaceReferenceSnapshot | null>;
  put(snapshot: WorkspaceReferenceSnapshot): Promise<void>;
}

const STORE_NAME = "snapshots";

export function buildWorkspaceReferenceSnapshot(
  participants: ParticipantsPage,
  currencies: CurrencyReference[],
  updatedAt = new Date().toISOString()
): WorkspaceReferenceSnapshot {
  return {
    tripId: participants.tripId,
    members: participants.members
      .filter((member) => member.status === "active")
      .map(({ id, displayName, role }) => ({ id, displayName, role })),
    families: participants.families.map(
      ({ id, displayName, shareCount }) => ({
        id,
        displayName,
        shareCount
      })
    ),
    currencies: currencies.map((currency) => ({ ...currency })),
    updatedAt
  };
}

export function createWorkspaceReferenceCache(
  databaseName = "owebee-workspace-cache"
): WorkspaceReferenceCache {
  const open = () =>
    openIndexedDatabase({
      name: databaseName,
      version: 1,
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: "tripId" });
        }
      }
    });

  return {
    async get(tripId) {
      const value = await runStoreRequest<unknown>({
        open,
        storeName: STORE_NAME,
        mode: "readonly",
        operation: (store) => store.get(tripId)
      });
      return isWorkspaceReferenceSnapshot(value) ? value : null;
    },

    async put(snapshot) {
      if (!isWorkspaceReferenceSnapshot(snapshot)) {
        throw new Error("Workspace reference snapshot is invalid");
      }
      await runStoreRequest({
        open,
        storeName: STORE_NAME,
        mode: "readwrite",
        operation: (store) => store.put(snapshot)
      });
    }
  };
}

function isWorkspaceReferenceSnapshot(
  value: unknown
): value is WorkspaceReferenceSnapshot {
  if (!isRecord(value)) return false;

  return (
    isUuid(value.tripId) &&
    isIsoDateTime(value.updatedAt) &&
    Array.isArray(value.members) &&
    value.members.every(isCachedMember) &&
    hasUniqueValues(value.members.map((member) => member.id)) &&
    Array.isArray(value.families) &&
    value.families.every(isCachedFamily) &&
    hasUniqueValues(value.families.map((family) => family.id)) &&
    Array.isArray(value.currencies) &&
    value.currencies.every(isCurrency) &&
    hasUniqueValues(value.currencies.map((currency) => currency.code))
  );
}

function isCachedMember(value: unknown): value is CachedMemberReference {
  return (
    isRecord(value) &&
    isUuid(value.id) &&
    hasText(value, "displayName") &&
    (value.role === "owner" || value.role === "participant")
  );
}

function isCachedFamily(value: unknown): value is CachedFamilyReference {
  return (
    isRecord(value) &&
    isUuid(value.id) &&
    hasText(value, "displayName") &&
    hasPositiveDecimal(value.shareCount)
  );
}

function isCurrency(value: unknown): value is CurrencyReference {
  return (
    isRecord(value) &&
    typeof value.code === "string" &&
    /^[A-Z]{3}$/.test(value.code) &&
    hasText(value, "displayName") &&
    (value.symbol === null || typeof value.symbol === "string") &&
    typeof value.minorUnits === "number" &&
    Number.isInteger(value.minorUnits) &&
    value.minorUnits >= 0 &&
    value.minorUnits <= 12
  );
}

function isIsoDateTime(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

function hasPositiveDecimal(value: unknown): boolean {
  return (
    typeof value === "string" &&
    /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) &&
    /[1-9]/.test(value)
  );
}

function hasText(value: Record<string, unknown>, key: string): boolean {
  return typeof value[key] === "string" && value[key].length > 0;
}

function hasUniqueValues(values: string[]): boolean {
  return new Set(values).size === values.length;
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
