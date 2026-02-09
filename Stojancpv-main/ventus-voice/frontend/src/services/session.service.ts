/**
 * Session Service
 * Service for managing voice AI sessions, analytics, and real-time monitoring
 */

import { API_BASE_URL } from "./config";
import type {
  Session,
  SessionDetail,
  SessionAnalytics,
  SessionParticipant,
  SessionMessage,
  SessionListParams,
  PaginatedSessions,
  SessionExportOptions,
  RealtimeStats,
  SessionTimelineEvent,
} from "../types/session.types";
import { SessionSchema, SessionAnalyticsSchema } from "../types/session.types";
import { z } from "zod";

class SessionService {
  private baseUrl: string;
  private getAuthToken?: () => Promise<string | null>;

  constructor(
    baseUrl: string = API_BASE_URL,
    getAuthToken?: () => Promise<string | null>,
  ) {
    this.baseUrl = baseUrl;
    this.getAuthToken = getAuthToken;
  }

  /**
   * Set auth token getter
   */
  setAuthTokenGetter(getter: () => Promise<string | null>) {
    this.getAuthToken = getter;
  }

  /**
   * Internal method to get authenticated headers
   */
  private async getHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (this.getAuthToken) {
      const token = await this.getAuthToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  /**
   * Internal fetch with error handling
   */
  private async fetch<T>(
    endpoint: string,
    options?: RequestInit,
    signal?: AbortSignal,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...(await this.getHeaders()),
        ...options?.headers,
      },
      signal,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: "Unknown error" }));
      throw new Error(
        error.message || `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    return response.json();
  }

  /**
   * Get sessions for an agent with filters and pagination
   */
  async getAgentSessions(
    agentId: string,
    params?: Omit<SessionListParams, "agentId">,
    signal?: AbortSignal,
  ): Promise<PaginatedSessions> {
    const searchParams = new URLSearchParams();
    searchParams.append("agentId", agentId);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach((v) => searchParams.append(key, v));
          } else {
            searchParams.append(key, String(value));
          }
        }
      });
    }

    const queryString = searchParams.toString();
    const url = `/api/sessions${queryString ? `?${queryString}` : ""}`;

    const data = await this.fetch<PaginatedSessions>(
      url,
      {
        method: "GET",
      },
      signal,
    );

    // Validate the session data
    data.data = z.array(SessionSchema).parse(data.data);
    return data;
  }

  /**
   * Get all sessions with filters and pagination
   */
  async getSessions(
    params?: SessionListParams,
    signal?: AbortSignal,
  ): Promise<PaginatedSessions> {
    const searchParams = new URLSearchParams();

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach((v) => searchParams.append(key, v));
          } else {
            searchParams.append(key, String(value));
          }
        }
      });
    }

    const queryString = searchParams.toString();
    const url = `/api/sessions${queryString ? `?${queryString}` : ""}`;

    const data = await this.fetch<PaginatedSessions>(
      url,
      {
        method: "GET",
      },
      signal,
    );

    data.data = z.array(SessionSchema).parse(data.data);
    return data;
  }

  /**
   * Get a single session by ID
   */
  async getSession(sessionId: string, signal?: AbortSignal): Promise<Session> {
    const data = await this.fetch<{ success: boolean; session: Session }>(
      `/api/sessions/${sessionId}`,
      {
        method: "GET",
      },
      signal,
    );
    // Backend wraps response in { success, session }
    const session = (data as any).session || data;
    return SessionSchema.parse(session);
  }

  /**
   * Get detailed session information including participants, messages, and timeline
   */
  async getSessionDetail(
    sessionId: string,
    signal?: AbortSignal,
  ): Promise<SessionDetail> {
    const data = await this.fetch<SessionDetail>(
      `/api/sessions/${sessionId}/detail`,
      {
        method: "GET",
      },
      signal,
    );
    return data;
  }

  /**
   * Get session analytics for an agent
   */
  async getSessionAnalytics(
    agentId?: string,
    dateFrom?: string,
    dateTo?: string,
    signal?: AbortSignal,
  ): Promise<SessionAnalytics> {
    const searchParams = new URLSearchParams();
    if (agentId) searchParams.append("agentId", agentId);
    if (dateFrom) searchParams.append("dateFrom", dateFrom);
    if (dateTo) searchParams.append("dateTo", dateTo);

    const queryString = searchParams.toString();
    const url = `/api/sessions/analytics${queryString ? `?${queryString}` : ""}`;

    const data = await this.fetch<SessionAnalytics>(
      url,
      {
        method: "GET",
      },
      signal,
    );
    return SessionAnalyticsSchema.parse(data);
  }

  /**
   * Get participants for a session
   */
  async getSessionParticipants(
    sessionId: string,
    signal?: AbortSignal,
  ): Promise<SessionParticipant[]> {
    const data = await this.fetch<{ success: boolean; data: SessionParticipant[]; count: number }>(
      `/api/sessions/${sessionId}/participants`,
      {
        method: "GET",
      },
      signal,
    );
    // Backend wraps response in { success, data, count }
    return (data as any).data || data;
  }

  /**
   * Get messages for a session
   */
  async getSessionMessages(
    sessionId: string,
    signal?: AbortSignal,
  ): Promise<SessionMessage[]> {
    const data = await this.fetch<SessionMessage[]>(
      `/api/sessions/${sessionId}/messages`,
      {
        method: "GET",
      },
      signal,
    );
    return data;
  }

  /**
   * Get timeline events for a session
   */
  async getSessionTimeline(
    sessionId: string,
    signal?: AbortSignal,
  ): Promise<SessionTimelineEvent[]> {
    const data = await this.fetch<SessionTimelineEvent[]>(
      `/api/sessions/${sessionId}/timeline`,
      {
        method: "GET",
      },
      signal,
    );
    return data;
  }

  /**
   * Export sessions data
   */
  async exportSessions(
    options: SessionExportOptions,
    signal?: AbortSignal,
  ): Promise<Blob> {
    const searchParams = new URLSearchParams();
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    const response = await fetch(
      `${this.baseUrl}/api/sessions/export?${searchParams.toString()}`,
      {
        method: "GET",
        headers: await this.getHeaders(),
        signal,
      },
    );

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: "Export failed" }));
      throw new Error(error.message || "Failed to export sessions");
    }

    return response.blob();
  }

  /**
   * Get real-time stats for active sessions
   */
  async getRealtimeStats(signal?: AbortSignal): Promise<RealtimeStats> {
    const data = await this.fetch<RealtimeStats>(
      "/api/sessions/realtime",
      {
        method: "GET",
      },
      signal,
    );
    return data;
  }

  /**
   * Create WebSocket connection for real-time session monitoring
   *
   * TODO: ARCHITECTURE MISMATCH - Backend uses Socket.IO at /socket.io path
   * (see backend/src/services/websocket.service.ts), but this uses raw WebSocket.
   * To fix properly:
   * 1. Install socket.io-client: npm install socket.io-client
   * 2. Create a SocketIOService that connects to /socket.io with Clerk auth token
   * 3. Subscribe to rooms like "analytics:{orgId}" or "session:{sessionId}"
   *
   * For now, connection will fail gracefully and fallback to REST polling.
   */
  createRealtimeWebSocket(): WebSocket {
    const wsUrl = this.baseUrl.replace("http", "ws");
    return new WebSocket(`${wsUrl}/api/sessions/realtime/ws`);
  }

  /**
   * Create WebSocket connection for a specific session
   *
   * TODO: See note above - needs Socket.IO client migration.
   * Backend expects: socket.io connection with room subscription "session:{sessionId}"
   */
  createSessionWebSocket(sessionId: string): WebSocket {
    const wsUrl = this.baseUrl.replace("http", "ws");
    return new WebSocket(`${wsUrl}/api/sessions/${sessionId}/ws`);
  }

  /**
   * End an active session
   */
  async endSession(sessionId: string, signal?: AbortSignal): Promise<Session> {
    const data = await this.fetch<{ success: boolean; session: Session }>(
      `/api/sessions/${sessionId}/end`,
      {
        method: "POST",
      },
      signal,
    );
    // Backend wraps response in { success, session }
    const session = (data as any).session || data;
    return SessionSchema.parse(session);
  }

  /**
   * Get session summary/notes
   */
  async getSessionSummary(
    sessionId: string,
    signal?: AbortSignal,
  ): Promise<{
    summary: string;
    keyPoints: string[];
    sentiment: string;
  }> {
    const data = await this.fetch<{
      summary: string;
      keyPoints: string[];
      sentiment: string;
    }>(
      `/api/sessions/${sessionId}/summary`,
      {
        method: "GET",
      },
      signal,
    );
    return data;
  }
}

// Export singleton instance
export const sessionService = new SessionService();

// Export class for custom instances
export { SessionService };
