import type { QueryClient } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { OidcInitializationGate, useOidc } from "#/lib/oidc";
import { invalidateRealtimeNotification } from "./invalidation";
import {
  createRealtimeNotificationClient,
  type RealtimeNotificationClient,
  type RealtimeNotificationHandler,
} from "./client";
import { userNotificationChannel } from "./channels";

type RealtimeNotificationsContextValue = {
  client: RealtimeNotificationClient | null;
};

const RealtimeNotificationsContext =
  createContext<RealtimeNotificationsContextValue>({ client: null });

type RealtimeNotificationsConnectionProps = {
  queryClient: QueryClient;
  seenEventIdsRef: { current: Set<string> };
  setClient: (client: RealtimeNotificationClient | null) => void;
};

export function RealtimeNotificationsProvider({
  children,
  queryClient,
}: {
  children: ReactNode;
  queryClient: QueryClient;
}) {
  const seenEventIdsRef = useRef(new Set<string>());
  const [client, setClient] = useState<RealtimeNotificationClient | null>(null);
  const value = useMemo(() => ({ client }), [client]);

  return (
    <RealtimeNotificationsContext.Provider value={value}>
      <OidcInitializationGate>
        <RealtimeNotificationsConnection
          queryClient={queryClient}
          seenEventIdsRef={seenEventIdsRef}
          setClient={setClient}
        />
      </OidcInitializationGate>
      {children}
    </RealtimeNotificationsContext.Provider>
  );
}

function RealtimeNotificationsConnection({
  queryClient,
  seenEventIdsRef,
  setClient,
}: RealtimeNotificationsConnectionProps) {
  const oidc = useOidc();

  useEffect(() => {
    if (!oidc.isUserLoggedIn) {
      setClient(null);
      return;
    }

    let stopped = false;
    let activeClient: RealtimeNotificationClient | null = null;

    void createRealtimeNotificationClient({
      onMessage: (message) => {
        if (seenEventIdsRef.current.has(message.eventId)) {
          return;
        }
        seenEventIdsRef.current.add(message.eventId);
        void invalidateRealtimeNotification(queryClient, message);
      },
    })
      .then(({ client: nextClient, userId }) => {
        if (stopped) {
          nextClient.disconnect();
          return;
        }
        activeClient = nextClient;
        nextClient.connect();
        nextClient.subscribe(userNotificationChannel(userId));
        setClient(nextClient);
      })
      .catch(() => {
        if (!stopped) {
          setClient(null);
        }
      });

    return () => {
      stopped = true;
      activeClient?.disconnect();
    };
  }, [oidc.isUserLoggedIn, queryClient, seenEventIdsRef, setClient]);

  return null;
}

export function useRealtimeNotificationChannel(
  channel: string | null,
  handler?: RealtimeNotificationHandler,
): void {
  const { client } = useContext(RealtimeNotificationsContext);

  useEffect(() => {
    if (!client || !channel) {
      return;
    }
    return client.subscribe(channel, handler);
  }, [channel, client, handler]);
}
