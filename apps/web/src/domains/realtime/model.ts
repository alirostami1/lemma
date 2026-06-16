export type RealtimeNotificationMessage = {
  schemaVersion: 1;
  eventId: string;
  eventType: string;
  lineage: {
    requestId: string;
    correlationId: string;
    causationId: string | null;
  };
  aggregate: {
    type: string;
    id: string;
  };
  payload: Record<string, unknown>;
  occurredAt: string;
};

export type RealtimeTokenResult = {
  token: string;
  expiresAt: string;
};
