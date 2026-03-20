import crypto from "crypto";
import { Request, Response } from "express";
import { google } from "googleapis";
import { db } from "../../init";
import { resolveFrontendAppOrigin } from "../../lib/frontend-app-url";
import { isGoogleCalendarSyncEnabled } from "../../lib/google-calendar-feature";
import { isTenantAdminRole } from "../../lib/auth-context";

const CALENDAR_EVENTS_COLLECTION = "calendar_events";
const CALENDAR_INTEGRATIONS_COLLECTION = "calendar_integrations";
const CALENDAR_OAUTH_STATES_COLLECTION = "calendar_oauth_states";

const DEFAULT_EVENT_COLOR = "#2563eb";
const OAUTH_STATE_TTL_MS = 15 * 60 * 1000;
const GOOGLE_INBOUND_SYNC_MIN_INTERVAL_MS = 15 * 1000;
const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events.owned",
  "https://www.googleapis.com/auth/userinfo.email",
];

type CalendarEventStatus = "scheduled" | "completed" | "canceled";
type GoogleSyncStatus = "disabled" | "synced" | "error" | "removed";
type GoogleSyncOrigin = "local" | "imported";

interface GoogleSyncMetadata {
  enabled: boolean;
  status: GoogleSyncStatus;
  provider: "google";
  origin?: GoogleSyncOrigin;
  calendarId?: string | null;
  externalEventId?: string | null;
  lastAttemptAt?: string | null;
  lastSyncedAt?: string | null;
  lastError?: string | null;
}

interface CalendarEventDocument {
  tenantId: string;
  ownerUserId: string;
  createdByUserId: string;
  updatedByUserId: string;
  title: string;
  description: string | null;
  location: string | null;
  status: CalendarEventStatus;
  color: string;
  isAllDay: boolean;
  startsAt: string | null;
  endsAt: string | null;
  startDate: string | null;
  endDate: string | null;
  startMs: number;
  endMs: number;
  googleSync: GoogleSyncMetadata;
  createdAt: string;
  updatedAt: string;
}

interface GoogleCalendarIntegrationDocument {
  tenantId: string;
  provider: "google";
  enabled: boolean;
  connectedEmail: string | null;
  calendarId: string;
  refreshToken: string;
  scopes: string[];
  connectedByUserId?: string | null;
  uid?: string;
  createdAt: string;
  updatedAt: string;
  lastSuccessfulSyncAt?: string | null;
  lastInboundSyncAt?: string | null;
  lastSyncError?: string | null;
}

interface GoogleCalendarIntegrationRecord {
  id: string;
  data: GoogleCalendarIntegrationDocument;
}

interface GoogleCalendarEventInput {
  id?: string | null;
  status?: string | null;
  summary?: string | null;
  description?: string | null;
  location?: string | null;
  extendedProperties?: {
    private?: {
      localEventId?: string | null;
    } | null;
  } | null;
  start?: {
    date?: string | null;
    dateTime?: string | null;
  } | null;
  end?: {
    date?: string | null;
    dateTime?: string | null;
  } | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeOptionalText(
  value: unknown,
  maxLength: number,
): string | null {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function normalizeStatus(value: unknown): CalendarEventStatus {
  const normalized = String(value || "scheduled").trim().toLowerCase();
  if (
    normalized === "scheduled" ||
    normalized === "completed" ||
    normalized === "canceled"
  ) {
    return normalized;
  }
  throw new Error("INVALID_STATUS");
}

function normalizeColor(value: unknown): string {
  const normalized = String(value || "").trim();
  if (!normalized) return DEFAULT_EVENT_COLOR;
  if (/^#([0-9a-fA-F]{6})$/.test(normalized)) {
    return normalized;
  }
  throw new Error("INVALID_COLOR");
}

function normalizeDateOnly(value: unknown): string {
  const normalized = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }
  throw new Error("INVALID_DATE");
}

function normalizeDateTime(value: unknown): string {
  const normalized = String(value || "").trim();
  const parsed = Date.parse(normalized);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }
  throw new Error("INVALID_DATETIME");
}

function toUtcMidnightMs(dateOnly: string): number {
  return Date.parse(`${dateOnly}T00:00:00.000Z`);
}

function addDays(dateOnly: string, days: number): string {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function sanitizeGoogleError(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: unknown }).response === "object" &&
    (error as { response?: { data?: unknown } }).response?.data
  ) {
    const responseData = (error as { response?: { data?: unknown } }).response
      ?.data;
    if (
      typeof responseData === "object" &&
      responseData !== null &&
      "error" in responseData
    ) {
      const nestedError = (responseData as { error?: unknown }).error;
      if (
        typeof nestedError === "object" &&
        nestedError !== null &&
        "message" in nestedError
      ) {
        return String((nestedError as { message?: unknown }).message || "");
      }
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown Google Calendar error.";
}

function isNotFoundGoogleError(error: unknown): boolean {
  const message = sanitizeGoogleError(error).toLowerCase();
  return (
    message.includes("not found") ||
    message.includes("resource has been deleted")
  );
}

function resolveRequestOrigin(req?: Request): string {
  if (!req && process.env.NODE_ENV === "production") {
    return resolveFrontendAppOrigin();
  }

  if (process.env.NODE_ENV === "production") {
    return resolveFrontendAppOrigin();
  }

  const forwardedProto = String(req?.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim();
  const forwardedHost = String(req?.headers["x-forwarded-host"] || "")
    .split(",")[0]
    .trim();
  const host = forwardedHost || String(req?.headers.host || "").trim();

  if (host) {
    const protocol =
      forwardedProto || (process.env.NODE_ENV === "production" ? "https" : "http");
    return `${protocol}://${host}`;
  }

  return resolveFrontendAppOrigin();
}

function buildFrontendCalendarUrl(
  req: Request | undefined,
  status: "connected" | "error",
  reason?: string,
): string {
  const url = new URL("/calendar", resolveRequestOrigin(req));
  url.searchParams.set("googleCalendar", status);
  if (reason) {
    url.searchParams.set("reason", reason);
  }
  return url.toString();
}

function isGoogleCalendarDisabled(): boolean {
  return !isGoogleCalendarSyncEnabled();
}

function resolveGoogleCalendarRedirectUri(req?: Request): string {
  const configured = String(process.env.GOOGLE_CALENDAR_REDIRECT_URI || "").trim();
  if (configured) {
    return configured;
  }

  return `${resolveRequestOrigin(req)}/api/backend/v1/calendar/google/callback`;
}

function createGoogleOAuthClient(req?: Request) {
  const clientId = String(process.env.GOOGLE_CALENDAR_CLIENT_ID || "").trim();
  const clientSecret = String(
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET || "",
  ).trim();

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CALENDAR_NOT_CONFIGURED");
  }

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    resolveGoogleCalendarRedirectUri(req),
  );
}

async function getGoogleIntegration(
  tenantId: string,
): Promise<GoogleCalendarIntegrationRecord | null> {
  const collection = db.collection(CALENDAR_INTEGRATIONS_COLLECTION);

  const normalizeIntegrationRecord = (
    id: string,
    rawData: GoogleCalendarIntegrationDocument | undefined,
  ): GoogleCalendarIntegrationRecord | null => {
    if (!rawData) {
      return null;
    }

    const connectedByUserId =
      normalizeOptionalText(rawData.connectedByUserId ?? rawData.uid, 128) || null;
    const normalizedTenantId = String(rawData.tenantId || "").trim();
    const refreshToken = String(rawData.refreshToken || "").trim();

    if (!normalizedTenantId || normalizedTenantId !== tenantId || !rawData.enabled) {
      return null;
    }

    if (!refreshToken) {
      return null;
    }

    return {
      id,
      data: {
        tenantId: normalizedTenantId,
        provider: "google",
        enabled: true,
        connectedEmail: normalizeOptionalText(rawData.connectedEmail, 320),
        calendarId: String(rawData.calendarId || "primary").trim() || "primary",
        refreshToken,
        scopes:
          Array.isArray(rawData.scopes) && rawData.scopes.length > 0
            ? rawData.scopes.map((scope) => String(scope || "").trim()).filter(Boolean)
            : GOOGLE_CALENDAR_SCOPES,
        connectedByUserId,
        uid: connectedByUserId || undefined,
        createdAt: String(rawData.createdAt || nowIso()).trim() || nowIso(),
        updatedAt: String(rawData.updatedAt || nowIso()).trim() || nowIso(),
        lastSuccessfulSyncAt:
          normalizeOptionalText(rawData.lastSuccessfulSyncAt, 64),
        lastInboundSyncAt: normalizeOptionalText(rawData.lastInboundSyncAt, 64),
        lastSyncError: normalizeOptionalText(rawData.lastSyncError, 500),
      },
    };
  };

  const directSnapshot = await collection.doc(tenantId).get();
  const directRecord = normalizeIntegrationRecord(
    directSnapshot.id,
    directSnapshot.data() as GoogleCalendarIntegrationDocument | undefined,
  );
  if (directRecord) {
    return directRecord;
  }

  const legacySnapshot = await collection
    .where("tenantId", "==", tenantId)
    .where("provider", "==", "google")
    .where("enabled", "==", true)
    .get();

  if (legacySnapshot.empty) {
    return null;
  }

  const legacyDoc = [...legacySnapshot.docs].sort((left, right) => {
    const leftUpdatedAt = Date.parse(
      String((left.data() as GoogleCalendarIntegrationDocument | undefined)?.updatedAt || ""),
    );
    const rightUpdatedAt = Date.parse(
      String((right.data() as GoogleCalendarIntegrationDocument | undefined)?.updatedAt || ""),
    );

    if (Number.isFinite(leftUpdatedAt) || Number.isFinite(rightUpdatedAt)) {
      return (Number.isFinite(rightUpdatedAt) ? rightUpdatedAt : 0) -
        (Number.isFinite(leftUpdatedAt) ? leftUpdatedAt : 0);
    }

    return right.createTime.toMillis() - left.createTime.toMillis();
  })[0];
  const legacyRecord = normalizeIntegrationRecord(
    legacyDoc.id,
    legacyDoc.data() as GoogleCalendarIntegrationDocument | undefined,
  );
  if (!legacyRecord) {
    return null;
  }

  const migratedRecord: GoogleCalendarIntegrationRecord = {
    id: tenantId,
    data: {
      ...legacyRecord.data,
      connectedByUserId:
        legacyRecord.data.connectedByUserId ||
        normalizeOptionalText(legacyDoc.id, 128) ||
        null,
      uid:
        legacyRecord.data.connectedByUserId ||
        normalizeOptionalText(legacyDoc.id, 128) ||
        undefined,
      updatedAt: nowIso(),
    },
  };

  await collection.doc(tenantId).set(migratedRecord.data, { merge: true });
  await legacyDoc.ref.delete().catch(() => undefined);
  return migratedRecord;
}

function buildGoogleDescription(eventData: CalendarEventDocument): string {
  const sections = [
    eventData.description,
    eventData.location ? `Local: ${eventData.location}` : null,
    `Status no ProOps: ${eventData.status}`,
    "Gerado automaticamente pelo calendario do ProOps.",
  ].filter(Boolean);

  return sections.join("\n\n");
}

function toGoogleEventResource(
  eventId: string,
  eventData: CalendarEventDocument,
) {
  const description = buildGoogleDescription(eventData);
  const base = {
    summary: eventData.title,
    description: description || undefined,
    location: eventData.location || undefined,
    extendedProperties: {
      private: {
        localEventId: eventId,
        proopsStatus: eventData.status,
      },
    },
  };

  if (eventData.isAllDay) {
    return {
      ...base,
      start: {
        date: eventData.startDate || undefined,
      },
      end: {
        date: eventData.endDate || undefined,
      },
    };
  }

  return {
    ...base,
    start: {
      dateTime: eventData.startsAt || undefined,
    },
    end: {
      dateTime: eventData.endsAt || undefined,
    },
  };
}

async function persistGoogleIntegrationStatus(
  integrationId: string,
  patch: Partial<GoogleCalendarIntegrationDocument>,
) {
  await db
    .collection(CALENDAR_INTEGRATIONS_COLLECTION)
    .doc(integrationId)
    .set(
      {
        ...patch,
        updatedAt: nowIso(),
      },
      { merge: true },
    );
}

function normalizeGoogleEventTitle(value: unknown): string {
  const normalized = String(value || "").trim();
  return normalized || "Compromisso do Google";
}

function buildGoogleSyncMetadataFromImportedEvent(params: {
  integration: GoogleCalendarIntegrationDocument;
  externalEventId: string;
  syncedAt: string;
  status: GoogleSyncStatus;
}): GoogleSyncMetadata {
  return {
    enabled: true,
    status: params.status,
    provider: "google",
    origin: "imported",
    calendarId: params.integration.calendarId,
    externalEventId: params.externalEventId,
    lastAttemptAt: params.syncedAt,
    lastSyncedAt: params.syncedAt,
    lastError: null,
  };
}

function extractCalendarEventTimingFromGoogleEvent(
  event: GoogleCalendarEventInput,
):
  | {
      isAllDay: boolean;
      startsAt: string | null;
      endsAt: string | null;
      startDate: string | null;
      endDate: string | null;
      startMs: number;
      endMs: number;
    }
  | null {
  const startDate = String(event.start?.date || "").trim();
  const endDate = String(event.end?.date || "").trim();

  if (startDate && endDate) {
    const startMs = toUtcMidnightMs(startDate);
    const endMs = toUtcMidnightMs(endDate);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      return null;
    }

    return {
      isAllDay: true,
      startsAt: null,
      endsAt: null,
      startDate,
      endDate,
      startMs,
      endMs,
    };
  }

  const startDateTime = String(event.start?.dateTime || "").trim();
  const endDateTime = String(event.end?.dateTime || "").trim();
  if (!startDateTime || !endDateTime) {
    return null;
  }

  const startsAt = normalizeDateTime(startDateTime);
  const endsAt = normalizeDateTime(endDateTime);
  const startMs = Date.parse(startsAt);
  const endMs = Date.parse(endsAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return null;
  }

  return {
    isAllDay: false,
    startsAt,
    endsAt,
    startDate: null,
    endDate: null,
    startMs,
    endMs,
  };
}

function buildCalendarEventDocumentFromGoogleEvent(params: {
  event: GoogleCalendarEventInput;
  integration: GoogleCalendarIntegrationDocument;
  ownerUserId: string;
  existing?: CalendarEventDocument;
}): CalendarEventDocument | null {
  const externalEventId = String(params.event.id || "").trim();
  if (!externalEventId) {
    return null;
  }

  const timing = extractCalendarEventTimingFromGoogleEvent(params.event);
  const googleStatus = String(params.event.status || "").trim().toLowerCase();
  const syncedAt = nowIso();

  if (!timing && googleStatus !== "cancelled") {
    return null;
  }

  if (googleStatus === "cancelled" && !params.existing) {
    return null;
  }

  return {
    tenantId: params.integration.tenantId,
    ownerUserId: params.ownerUserId,
    createdByUserId:
      params.existing?.createdByUserId || params.ownerUserId,
    updatedByUserId: params.ownerUserId,
    title:
      googleStatus === "cancelled" && params.existing
        ? params.existing.title
        : normalizeGoogleEventTitle(params.event.summary),
    description:
      googleStatus === "cancelled" && params.existing
        ? params.existing.description
        : normalizeOptionalText(params.event.description, 4000),
    location:
      googleStatus === "cancelled" && params.existing
        ? params.existing.location
        : normalizeOptionalText(params.event.location, 240),
    status: googleStatus === "cancelled" ? "canceled" : "scheduled",
    color: params.existing?.color || DEFAULT_EVENT_COLOR,
    isAllDay: timing?.isAllDay ?? params.existing?.isAllDay ?? false,
    startsAt: timing?.startsAt ?? params.existing?.startsAt ?? null,
    endsAt: timing?.endsAt ?? params.existing?.endsAt ?? null,
    startDate: timing?.startDate ?? params.existing?.startDate ?? null,
    endDate: timing?.endDate ?? params.existing?.endDate ?? null,
    startMs: timing?.startMs ?? params.existing?.startMs ?? 0,
    endMs: timing?.endMs ?? params.existing?.endMs ?? 0,
    googleSync: buildGoogleSyncMetadataFromImportedEvent({
      integration: params.integration,
      externalEventId,
      syncedAt,
      status: googleStatus === "cancelled" ? "removed" : "synced",
    }),
    createdAt: params.existing?.createdAt || syncedAt,
    updatedAt: syncedAt,
  };
}

async function listGoogleLinkedCalendarEventsByExternalId(params: {
  tenantId: string;
}): Promise<Map<string, { id: string; data: CalendarEventDocument }>> {
  const snapshot = await db
    .collection(CALENDAR_EVENTS_COLLECTION)
    .where("tenantId", "==", params.tenantId)
    .get();

  const eventsByExternalId = new Map<string, { id: string; data: CalendarEventDocument }>();

  snapshot.docs.forEach((doc) => {
    const data = doc.data() as CalendarEventDocument;
    const externalEventId = String(data.googleSync?.externalEventId || "").trim();

    if (
      data.googleSync?.provider !== "google" ||
      !externalEventId
    ) {
      return;
    }

    eventsByExternalId.set(externalEventId, {
      id: doc.id,
      data,
    });
  });

  return eventsByExternalId;
}

async function syncGoogleEventsToLocalCalendar(params: {
  tenantId: string;
  startMs: number;
  endMs: number;
}) {
  if (isGoogleCalendarDisabled()) {
    return;
  }

  const integrationRecord = await getGoogleIntegration(params.tenantId);
  if (!integrationRecord) {
    return;
  }
  const integration = integrationRecord.data;

  const lastInboundSyncAtMs = Date.parse(String(integration.lastInboundSyncAt || ""));
  if (
    Number.isFinite(lastInboundSyncAtMs) &&
    Date.now() - lastInboundSyncAtMs < GOOGLE_INBOUND_SYNC_MIN_INTERVAL_MS
  ) {
    return;
  }

  const oauthClient = createGoogleOAuthClient();
  oauthClient.setCredentials({
    refresh_token: integration.refreshToken,
  });

  const calendar = google.calendar({
    version: "v3",
    auth: oauthClient,
  });

  try {
    const [localEventsByExternalId, googleResponse] = await Promise.all([
      listGoogleLinkedCalendarEventsByExternalId({
        tenantId: params.tenantId,
      }),
      calendar.events.list({
        calendarId: integration.calendarId,
        singleEvents: true,
        orderBy: "startTime",
        showDeleted: true,
        timeMin: new Date(params.startMs).toISOString(),
        timeMax: new Date(params.endMs).toISOString(),
      }),
    ]);

    const googleEvents = googleResponse.data.items || [];
    if (googleEvents.length === 0) {
      await persistGoogleIntegrationStatus(integrationRecord.id, {
        lastInboundSyncAt: nowIso(),
        lastSuccessfulSyncAt: nowIso(),
        lastSyncError: null,
      });
      return;
    }

    const batch = db.batch();
    let hasWrites = false;

    googleEvents.forEach((googleEvent) => {
      const externalEventId = String(googleEvent.id || "").trim();
      if (!externalEventId) {
        return;
      }

      const existing = localEventsByExternalId.get(externalEventId);
      const ownerUserId =
        existing?.data.ownerUserId ||
        integration.connectedByUserId ||
        integration.uid ||
        "";
      if (!ownerUserId) {
        return;
      }

      const nextDocument = buildCalendarEventDocumentFromGoogleEvent({
        event: googleEvent,
        integration,
        ownerUserId,
        existing: existing?.data,
      });

      if (!nextDocument) {
        return;
      }

      const docRef = existing
        ? db.collection(CALENDAR_EVENTS_COLLECTION).doc(existing.id)
        : db.collection(CALENDAR_EVENTS_COLLECTION).doc();

      batch.set(docRef, nextDocument, { merge: false });
      hasWrites = true;
    });

    if (hasWrites) {
      await batch.commit();
    }

    await persistGoogleIntegrationStatus(integrationRecord.id, {
      lastInboundSyncAt: nowIso(),
      lastSuccessfulSyncAt: nowIso(),
      lastSyncError: null,
    });
  } catch (error) {
    const message = sanitizeGoogleError(error);
    await persistGoogleIntegrationStatus(integrationRecord.id, {
      lastSyncError: message,
    });
    throw error;
  }
}

async function syncEventToGoogle(
  eventId: string,
  eventData: CalendarEventDocument,
): Promise<GoogleSyncMetadata> {
  if (isGoogleCalendarDisabled()) {
    return buildBaseGoogleSyncMetadata();
  }

  const attemptedAt = nowIso();
  const integrationRecord = await getGoogleIntegration(eventData.tenantId);

  if (!integrationRecord) {
    return {
      enabled: false,
      status: "disabled",
      provider: "google",
      lastAttemptAt: attemptedAt,
      lastError: null,
      externalEventId: null,
      calendarId: null,
    };
  }
  const integration = integrationRecord.data;

  const oauthClient = createGoogleOAuthClient();
  oauthClient.setCredentials({
    refresh_token: integration.refreshToken,
  });

  const calendar = google.calendar({
    version: "v3",
    auth: oauthClient,
  });

  if (eventData.status === "canceled") {
    try {
      if (eventData.googleSync?.externalEventId) {
        await calendar.events.delete({
          calendarId: integration.calendarId,
          eventId: eventData.googleSync.externalEventId,
        });
      }

      await persistGoogleIntegrationStatus(integrationRecord.id, {
        lastSuccessfulSyncAt: attemptedAt,
        lastSyncError: null,
      });

      return {
        enabled: true,
        status: "removed",
        provider: "google",
        origin: "local",
        calendarId: integration.calendarId,
        externalEventId: null,
        lastAttemptAt: attemptedAt,
        lastSyncedAt: attemptedAt,
        lastError: null,
      };
    } catch (error) {
      if (isNotFoundGoogleError(error)) {
        return {
          enabled: true,
          status: "removed",
          provider: "google",
          origin: "local",
          calendarId: integration.calendarId,
          externalEventId: null,
          lastAttemptAt: attemptedAt,
          lastSyncedAt: attemptedAt,
          lastError: null,
        };
      }

      const message = sanitizeGoogleError(error);
      await persistGoogleIntegrationStatus(integrationRecord.id, {
        lastSyncError: message,
      });

      return {
        enabled: true,
        status: "error",
        provider: "google",
        origin: "local",
        calendarId: integration.calendarId,
        externalEventId: eventData.googleSync?.externalEventId || null,
        lastAttemptAt: attemptedAt,
        lastError: message,
      };
    }
  }

  try {
    const payload = toGoogleEventResource(eventId, eventData);
    const response = eventData.googleSync?.externalEventId
      ? await calendar.events.update({
          calendarId: integration.calendarId,
          eventId: eventData.googleSync.externalEventId,
          requestBody: payload,
        })
      : await calendar.events.insert({
          calendarId: integration.calendarId,
          requestBody: payload,
        });

    const syncedAt = nowIso();
    const externalEventId = String(response.data.id || "").trim() || null;

    await persistGoogleIntegrationStatus(integrationRecord.id, {
      lastSuccessfulSyncAt: syncedAt,
      lastSyncError: null,
    });

    return {
      enabled: true,
      status: "synced",
      provider: "google",
      origin: "local",
      calendarId: integration.calendarId,
      externalEventId,
      lastAttemptAt: attemptedAt,
      lastSyncedAt: syncedAt,
      lastError: null,
    };
  } catch (error) {
    const message = sanitizeGoogleError(error);
    await persistGoogleIntegrationStatus(integrationRecord.id, {
      lastSyncError: message,
    });

    return {
      enabled: true,
      status: "error",
      provider: "google",
      origin: "local",
      calendarId: integration.calendarId,
      externalEventId: eventData.googleSync?.externalEventId || null,
      lastAttemptAt: attemptedAt,
      lastError: message,
    };
  }
}

async function deleteEventFromGoogleIfNeeded(eventData: CalendarEventDocument) {
  if (isGoogleCalendarDisabled()) {
    return;
  }

  const externalEventId = eventData.googleSync?.externalEventId;
  if (!externalEventId) {
    return;
  }

  const integrationRecord = await getGoogleIntegration(eventData.tenantId);
  if (!integrationRecord) {
    return;
  }
  const integration = integrationRecord.data;

  const oauthClient = createGoogleOAuthClient();
  oauthClient.setCredentials({
    refresh_token: integration.refreshToken,
  });

  const calendar = google.calendar({
    version: "v3",
    auth: oauthClient,
  });

  try {
    await calendar.events.delete({
      calendarId: integration.calendarId,
      eventId: externalEventId,
    });
    await persistGoogleIntegrationStatus(integrationRecord.id, {
      lastSuccessfulSyncAt: nowIso(),
      lastSyncError: null,
    });
  } catch (error) {
    if (!isNotFoundGoogleError(error)) {
      await persistGoogleIntegrationStatus(integrationRecord.id, {
        lastSyncError: sanitizeGoogleError(error),
      });
    }
  }
}

function canViewCalendarEvents(req: Request): boolean {
  return Boolean(req.user?.uid && req.user.tenantId);
}

function canManageGoogleCalendarIntegration(req: Request): boolean {
  return Boolean(req.user?.isSuperAdmin || isTenantAdminRole(req.user?.role || ""));
}

function serializeCalendarEvent(
  docId: string,
  data: CalendarEventDocument,
): CalendarEventDocument & { id: string } {
  const serializedGoogleSync = isGoogleCalendarDisabled()
    ? buildBaseGoogleSyncMetadata()
    : data.googleSync;

  return {
    id: docId,
    ...data,
    googleSync: serializedGoogleSync,
  };
}

function canManageCalendarEvent(
  req: Request,
  eventData: CalendarEventDocument,
): boolean {
  if (!req.user?.uid || !req.user?.tenantId) {
    return false;
  }

  if (eventData.tenantId !== req.user.tenantId) {
    return false;
  }

  if (eventData.googleSync?.provider === "google" && eventData.googleSync.enabled) {
    return true;
  }

  return (
    eventData.ownerUserId === req.user.uid ||
    req.user.isSuperAdmin ||
    isTenantAdminRole(req.user.role)
  );
}

function buildBaseGoogleSyncMetadata(): GoogleSyncMetadata {
  return {
    enabled: false,
    status: "disabled",
    provider: "google",
    origin: "local",
    calendarId: null,
    externalEventId: null,
    lastAttemptAt: null,
    lastSyncedAt: null,
    lastError: null,
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error || "Unknown error");
}

async function cleanupLocalEventsAfterGoogleDisconnect(params: {
  tenantId: string;
  integration: GoogleCalendarIntegrationDocument;
  req?: Request;
}) {
  const snapshot = await db
    .collection(CALENDAR_EVENTS_COLLECTION)
    .where("tenantId", "==", params.tenantId)
    .get();

  const syncedDocs = snapshot.docs.filter((doc) => {
    const data = doc.data() as CalendarEventDocument;
    return Boolean(
      data.googleSync?.provider === "google" && data.googleSync?.externalEventId,
    );
  });

  if (syncedDocs.length === 0) {
    return;
  }

  const oauthClient = createGoogleOAuthClient(params.req);
  oauthClient.setCredentials({
    refresh_token: params.integration.refreshToken,
  });

  const calendar = google.calendar({
    version: "v3",
    auth: oauthClient,
  });

  const cleanupActions = await Promise.all(
    syncedDocs.map(async (doc) => {
      const data = doc.data() as CalendarEventDocument;
      const syncOrigin = String(data.googleSync?.origin || "")
        .trim()
        .toLowerCase();

      if (syncOrigin === "local") {
        return { ref: doc.ref, type: "reset" as const };
      }

      if (syncOrigin === "imported") {
        return { ref: doc.ref, type: "delete" as const };
      }

      try {
        const googleEvent = await calendar.events.get({
          calendarId: params.integration.calendarId,
          eventId: String(data.googleSync?.externalEventId || "").trim(),
        });
        const linkedLocalEventId = String(
          googleEvent.data.extendedProperties?.private?.localEventId || "",
        ).trim();

        return {
          ref: doc.ref,
          type: linkedLocalEventId === doc.id ? ("reset" as const) : ("delete" as const),
        };
      } catch (error) {
        if (!isNotFoundGoogleError(error)) {
          console.warn(
            "[CalendarController] Unable to inspect Google event before disconnect, keeping local event:",
            error,
          );
        }

        return { ref: doc.ref, type: "reset" as const };
      }
    }),
  );

  const batch = db.batch();
  const resetPayload = {
    googleSync: buildBaseGoogleSyncMetadata(),
    updatedAt: nowIso(),
  };

  cleanupActions.forEach((action) => {
    if (action.type === "delete") {
      batch.delete(action.ref);
      return;
    }

    batch.set(action.ref, resetPayload, { merge: true });
  });

  await batch.commit();
}

function buildCalendarEventsErrorResponse(error: unknown): {
  message: string;
  details?: string;
} {
  const response: { message: string; details?: string } = {
    message: "Nao foi possivel carregar os compromissos.",
  };

  if (process.env.NODE_ENV !== "production") {
    response.details = getErrorMessage(error);
  }

  return response;
}

async function listCalendarEventsWithOptimizedQuery(params: {
  tenantId: string;
  startMs: number;
  endMs: number;
}): Promise<Array<CalendarEventDocument & { id: string }>> {
  const queryRef = db
    .collection(CALENDAR_EVENTS_COLLECTION)
    .where("tenantId", "==", params.tenantId)
    .where("startMs", ">=", params.startMs)
    .where("startMs", "<=", params.endMs)
    .orderBy("startMs", "asc");

  const snapshot = await queryRef.get();
  return snapshot.docs.map((doc) =>
    serializeCalendarEvent(doc.id, doc.data() as CalendarEventDocument),
  );
}

async function listCalendarEventsWithTenantFallback(params: {
  tenantId: string;
  startMs: number;
  endMs: number;
}): Promise<Array<CalendarEventDocument & { id: string }>> {
  const snapshot = await db
    .collection(CALENDAR_EVENTS_COLLECTION)
    .where("tenantId", "==", params.tenantId)
    .get();

  return snapshot.docs
    .map((doc) => serializeCalendarEvent(doc.id, doc.data() as CalendarEventDocument))
    .filter((event) => {
      const eventStartMs = Number(event.startMs);
      if (!Number.isFinite(eventStartMs)) {
        return false;
      }

      if (eventStartMs < params.startMs || eventStartMs > params.endMs) {
        return false;
      }

      return true;
    })
    .sort((left, right) => Number(left.startMs) - Number(right.startMs));
}

export async function getCalendarEvents(req: Request, res: Response) {
  try {
    if (!canViewCalendarEvents(req) || !req.user?.tenantId || !req.user.uid) {
      return res.status(403).json({ message: "Tenant nao identificado." });
    }

    const startMs = Number(req.query.startMs);
    const endMs = Number(req.query.endMs);

    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      return res.status(400).json({ message: "Periodo invalido." });
    }

    try {
      await syncGoogleEventsToLocalCalendar({
        tenantId: req.user.tenantId,
        startMs,
        endMs,
      });
    } catch (googleSyncError) {
      console.warn(
        "[CalendarController] Unable to import Google Calendar changes before listing events:",
        googleSyncError,
      );
    }

    let events: Array<CalendarEventDocument & { id: string }>;

    try {
      events = await listCalendarEventsWithOptimizedQuery({
        tenantId: req.user.tenantId,
        startMs,
        endMs,
      });
    } catch (queryError) {
      console.warn(
        "[CalendarController] Optimized calendar query failed, using tenant fallback:",
        queryError,
      );

      events = await listCalendarEventsWithTenantFallback({
        tenantId: req.user.tenantId,
        startMs,
        endMs,
      });
    }

    return res.json({
      success: true,
      events,
    });
  } catch (error) {
    console.error("[CalendarController] Error listing calendar events:", error);
    return res.status(500).json(buildCalendarEventsErrorResponse(error));
  }
}

function buildCalendarEventDocument(params: {
  input: Record<string, unknown>;
  tenantId: string;
  ownerUserId: string;
  actingUserId: string;
  existing?: CalendarEventDocument;
}): CalendarEventDocument {
  const title = String(params.input.title || "").trim();
  if (!title) {
    throw new Error("TITLE_REQUIRED");
  }
  if (title.length > 140) {
    throw new Error("TITLE_TOO_LONG");
  }

  const isAllDay = Boolean(params.input.isAllDay);
  const status = normalizeStatus(params.input.status);
  const color = normalizeColor(params.input.color);
  const description = normalizeOptionalText(params.input.description, 4000);
  const location = normalizeOptionalText(params.input.location, 240);

  let startsAt: string | null = null;
  let endsAt: string | null = null;
  let startDate: string | null = null;
  let endDate: string | null = null;
  let startMs = 0;
  let endMs = 0;

  if (isAllDay) {
    startDate = normalizeDateOnly(params.input.startDate);
    endDate = params.input.endDate
      ? normalizeDateOnly(params.input.endDate)
      : addDays(startDate, 1);

    if (endDate <= startDate) {
      throw new Error("INVALID_DATE_RANGE");
    }

    startMs = toUtcMidnightMs(startDate);
    endMs = toUtcMidnightMs(endDate);
  } else {
    startsAt = normalizeDateTime(params.input.startsAt);
    endsAt = normalizeDateTime(params.input.endsAt);

    startMs = Date.parse(startsAt);
    endMs = Date.parse(endsAt);

    if (endMs <= startMs) {
      throw new Error("INVALID_TIME_RANGE");
    }
  }

  const createdAt = params.existing?.createdAt || nowIso();

  return {
    tenantId: params.tenantId,
    ownerUserId: params.ownerUserId,
    createdByUserId: params.existing?.createdByUserId || params.actingUserId,
    updatedByUserId: params.actingUserId,
    title,
    description,
    location,
    status,
    color,
    isAllDay,
    startsAt,
    endsAt,
    startDate,
    endDate,
    startMs,
    endMs,
    googleSync: params.existing?.googleSync || buildBaseGoogleSyncMetadata(),
    createdAt,
    updatedAt: nowIso(),
  };
}

function getValidationMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "";

  switch (code) {
    case "TITLE_REQUIRED":
      return "Informe um titulo para o compromisso.";
    case "TITLE_TOO_LONG":
      return "O titulo deve ter no maximo 140 caracteres.";
    case "INVALID_COLOR":
      return "Cor invalida.";
    case "INVALID_STATUS":
      return "Status invalido.";
    case "INVALID_DATE":
      return "Data invalida.";
    case "INVALID_DATETIME":
      return "Data e hora invalidas.";
    case "INVALID_DATE_RANGE":
      return "A data final precisa ser maior que a inicial.";
    case "INVALID_TIME_RANGE":
      return "O horario final precisa ser maior que o inicial.";
    default:
      return "Dados do compromisso invalidos.";
  }
}

export async function getGoogleCalendarAuthUrl(req: Request, res: Response) {
  try {
    if (isGoogleCalendarDisabled()) {
      return res.status(503).json({
        message: "A integracao com Google Agenda esta temporariamente desabilitada.",
      });
    }

    if (!req.user?.uid || !req.user.tenantId) {
      return res.status(403).json({ message: "Tenant nao identificado." });
    }
    if (!canManageGoogleCalendarIntegration(req)) {
      return res.status(403).json({
        message: "Somente administradores podem conectar a agenda da empresa.",
      });
    }

    const oauthClient = createGoogleOAuthClient(req);
    const state = crypto.randomUUID();

    await db.collection(CALENDAR_OAUTH_STATES_COLLECTION).doc(state).set({
      uid: req.user.uid,
      tenantId: req.user.tenantId,
      createdAt: nowIso(),
      expiresAtMs: Date.now() + OAUTH_STATE_TTL_MS,
    });

    const authUrl = oauthClient.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: GOOGLE_CALENDAR_SCOPES,
      include_granted_scopes: true,
      state,
    });

    return res.json({ success: true, authUrl });
  } catch (error) {
    console.error("[CalendarController] Error generating Google auth URL:", error);

    const message =
      error instanceof Error &&
      error.message === "GOOGLE_CALENDAR_NOT_CONFIGURED"
        ? "Configure GOOGLE_CALENDAR_CLIENT_ID e GOOGLE_CALENDAR_CLIENT_SECRET."
        : "Nao foi possivel iniciar a conexao com o Google Agenda.";

    return res.status(500).json({ message });
  }
}

export async function handleGoogleCalendarCallback(req: Request, res: Response) {
  if (isGoogleCalendarDisabled()) {
    return res.redirect(buildFrontendCalendarUrl(req, "error", "integration_disabled"));
  }

  const state = String(req.query.state || "").trim();
  const code = String(req.query.code || "").trim();

  if (!state || !code) {
    return res.redirect(buildFrontendCalendarUrl(req, "error", "missing_code"));
  }

  try {
    const stateRef = db.collection(CALENDAR_OAUTH_STATES_COLLECTION).doc(state);
    const stateSnapshot = await stateRef.get();

    if (!stateSnapshot.exists) {
      return res.redirect(buildFrontendCalendarUrl(req, "error", "invalid_state"));
    }

    const stateData = stateSnapshot.data() as
      | { uid?: string; tenantId?: string; expiresAtMs?: number }
      | undefined;

    if (!stateData?.uid || !stateData.tenantId) {
      await stateRef.delete().catch(() => undefined);
      return res.redirect(buildFrontendCalendarUrl(req, "error", "invalid_state"));
    }

    if (
      typeof stateData.expiresAtMs === "number" &&
      Date.now() > stateData.expiresAtMs
    ) {
      await stateRef.delete().catch(() => undefined);
      return res.redirect(buildFrontendCalendarUrl(req, "error", "expired_state"));
    }

    const oauthClient = createGoogleOAuthClient(req);
    const tokenResponse = await oauthClient.getToken(code);
    const tokens = tokenResponse.tokens;
    oauthClient.setCredentials(tokens);

    const existingIntegration = await getGoogleIntegration(stateData.tenantId);

    const existingRefreshToken = String(
      existingIntegration?.data.refreshToken || "",
    ).trim();
    const refreshToken =
      String(tokens.refresh_token || "").trim() || existingRefreshToken;

    if (!refreshToken) {
      throw new Error("MISSING_REFRESH_TOKEN");
    }

    const oauth2 = google.oauth2({
      version: "v2",
      auth: oauthClient,
    });
    const userInfo = await oauth2.userinfo.get();
    const email = String(userInfo.data.email || "").trim() || null;
    const syncedAt = nowIso();

    await db
      .collection(CALENDAR_INTEGRATIONS_COLLECTION)
      .doc(stateData.tenantId)
      .set({
        tenantId: stateData.tenantId,
        provider: "google",
        enabled: true,
        connectedEmail: email,
        calendarId: "primary",
        refreshToken,
        scopes: GOOGLE_CALENDAR_SCOPES,
        connectedByUserId: stateData.uid,
        uid: stateData.uid,
        createdAt: existingIntegration?.data.createdAt || syncedAt,
        updatedAt: syncedAt,
        lastSuccessfulSyncAt: existingIntegration?.data.lastSuccessfulSyncAt || null,
        lastSyncError: null,
      } satisfies GoogleCalendarIntegrationDocument);

    await stateRef.delete().catch(() => undefined);
    return res.redirect(buildFrontendCalendarUrl(req, "connected"));
  } catch (error) {
    console.error("[CalendarController] Error handling Google callback:", error);
    await db
      .collection(CALENDAR_OAUTH_STATES_COLLECTION)
      .doc(state)
      .delete()
      .catch(() => undefined);

    return res.redirect(buildFrontendCalendarUrl(req, "error", "oauth_failed"));
  }
}

export async function getGoogleCalendarStatus(req: Request, res: Response) {
  try {
    if (isGoogleCalendarDisabled()) {
      return res.json({
        success: true,
        enabled: false,
        connected: false,
      });
    }

    if (!req.user?.uid || !req.user.tenantId) {
      return res.status(403).json({ message: "Tenant nao identificado." });
    }

    const integration = await getGoogleIntegration(req.user.tenantId);

    if (!integration) {
      return res.json({
        success: true,
        enabled: true,
        connected: false,
      });
    }

    return res.json({
      success: true,
      enabled: true,
      connected: true,
      email: integration.data.connectedEmail,
      calendarId: integration.data.calendarId,
      connectedAt: integration.data.createdAt,
      lastSuccessfulSyncAt: integration.data.lastSuccessfulSyncAt || null,
      lastSyncError: integration.data.lastSyncError || null,
    });
  } catch (error) {
    console.error("[CalendarController] Error loading Google status:", error);
    return res
      .status(500)
      .json({ message: "Nao foi possivel carregar a integracao do Google." });
  }
}

export async function disconnectGoogleCalendar(req: Request, res: Response) {
  try {
    if (isGoogleCalendarDisabled()) {
      return res.status(204).send();
    }

    if (!req.user?.uid || !req.user.tenantId) {
      return res.status(403).json({ message: "Tenant nao identificado." });
    }
    if (!canManageGoogleCalendarIntegration(req)) {
      return res.status(403).json({
        message: "Somente administradores podem desconectar a agenda da empresa.",
      });
    }

    const integration = await getGoogleIntegration(req.user.tenantId);
    if (!integration) {
      return res.status(204).send();
    }
    const docRef = db.collection(CALENDAR_INTEGRATIONS_COLLECTION).doc(integration.id);

    await cleanupLocalEventsAfterGoogleDisconnect({
      tenantId: req.user.tenantId,
      integration: integration.data,
      req,
    });

    if (integration.data.refreshToken) {
      try {
        const oauthClient = createGoogleOAuthClient(req);
        await oauthClient.revokeToken(integration.data.refreshToken);
      } catch (error) {
        console.warn(
          "[CalendarController] Unable to revoke Google refresh token:",
          error,
        );
      }
    }

    const allIntegrationDocs = await db
      .collection(CALENDAR_INTEGRATIONS_COLLECTION)
      .where("tenantId", "==", req.user.tenantId)
      .where("provider", "==", "google")
      .get();

    await Promise.all(
      allIntegrationDocs.docs.map((integrationDoc) =>
        integrationDoc.ref.delete().catch(() => undefined),
      ),
    );
    await docRef.delete().catch(() => undefined);
    return res.status(204).send();
  } catch (error) {
    console.error("[CalendarController] Error disconnecting Google:", error);
    return res
      .status(500)
      .json({ message: "Nao foi possivel desconectar o Google Agenda." });
  }
}

export async function createCalendarEvent(req: Request, res: Response) {
  try {
    if (!req.user?.uid || !req.user.tenantId) {
      return res.status(403).json({ message: "Tenant nao identificado." });
    }

    const docRef = db.collection(CALENDAR_EVENTS_COLLECTION).doc();
    const eventData = buildCalendarEventDocument({
      input: req.body as Record<string, unknown>,
      tenantId: req.user.tenantId,
      ownerUserId: req.user.uid,
      actingUserId: req.user.uid,
    });

    const googleSync = await syncEventToGoogle(docRef.id, eventData);
    const persistedEvent = {
      ...eventData,
      googleSync,
    };

    await docRef.set(persistedEvent);

    return res.status(201).json({
      success: true,
      event: {
        id: docRef.id,
        ...persistedEvent,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      [
        "TITLE_REQUIRED",
        "TITLE_TOO_LONG",
        "INVALID_COLOR",
        "INVALID_STATUS",
        "INVALID_DATE",
        "INVALID_DATETIME",
        "INVALID_DATE_RANGE",
        "INVALID_TIME_RANGE",
      ].includes(error.message)
    ) {
      return res.status(400).json({ message: getValidationMessage(error) });
    }

    console.error("[CalendarController] Error creating calendar event:", error);
    return res
      .status(500)
      .json({ message: "Nao foi possivel criar o compromisso." });
  }
}

export async function updateCalendarEvent(req: Request, res: Response) {
  try {
    if (!req.user?.uid || !req.user.tenantId) {
      return res.status(403).json({ message: "Tenant nao identificado." });
    }

    const { id } = req.params;
    const docRef = db.collection(CALENDAR_EVENTS_COLLECTION).doc(id);
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      return res.status(404).json({ message: "Compromisso nao encontrado." });
    }

    const existingData = snapshot.data() as CalendarEventDocument;

    if (!canManageCalendarEvent(req, existingData)) {
      return res.status(403).json({ message: "Acesso negado." });
    }

    const mergedInput = {
      ...existingData,
      ...(req.body as Record<string, unknown>),
      ownerUserId: existingData.ownerUserId,
      createdByUserId: existingData.createdByUserId,
    };

    const nextEventData = buildCalendarEventDocument({
      input: mergedInput,
      tenantId: existingData.tenantId,
      ownerUserId: existingData.ownerUserId,
      actingUserId: req.user.uid,
      existing: existingData,
    });

    const googleSync = await syncEventToGoogle(id, nextEventData);
    const persistedEvent = {
      ...nextEventData,
      googleSync,
    };

    await docRef.set(persistedEvent, { merge: false });

    return res.json({
      success: true,
      event: {
        id,
        ...persistedEvent,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      [
        "TITLE_REQUIRED",
        "TITLE_TOO_LONG",
        "INVALID_COLOR",
        "INVALID_STATUS",
        "INVALID_DATE",
        "INVALID_DATETIME",
        "INVALID_DATE_RANGE",
        "INVALID_TIME_RANGE",
      ].includes(error.message)
    ) {
      return res.status(400).json({ message: getValidationMessage(error) });
    }

    console.error("[CalendarController] Error updating calendar event:", error);
    return res
      .status(500)
      .json({ message: "Nao foi possivel atualizar o compromisso." });
  }
}

export async function deleteCalendarEvent(req: Request, res: Response) {
  try {
    if (!req.user?.uid || !req.user.tenantId) {
      return res.status(403).json({ message: "Tenant nao identificado." });
    }

    const { id } = req.params;
    const docRef = db.collection(CALENDAR_EVENTS_COLLECTION).doc(id);
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      return res.status(404).json({ message: "Compromisso nao encontrado." });
    }

    const existingData = snapshot.data() as CalendarEventDocument;
    if (!canManageCalendarEvent(req, existingData)) {
      return res.status(403).json({ message: "Acesso negado." });
    }

    await deleteEventFromGoogleIfNeeded(existingData);
    await docRef.delete();

    return res.status(204).send();
  } catch (error) {
    console.error("[CalendarController] Error deleting calendar event:", error);
    return res
      .status(500)
      .json({ message: "Nao foi possivel excluir o compromisso." });
  }
}
