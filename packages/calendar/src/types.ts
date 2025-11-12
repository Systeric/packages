import { z } from "zod";

export const CalendarEventSchema = z.object({
  id: z.string(),
  summary: z.string(),
  description: z.string().optional(),
  start: z.object({
    dateTime: z.string().optional(),
    date: z.string().optional(),
  }),
  end: z.object({
    dateTime: z.string().optional(),
    date: z.string().optional(),
  }),
});

export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

export interface ListEventsOptions {
  calendarId?: string;
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
}

/**
 * Calendar provider adapter interface
 * Implement this interface to add support for new calendar providers (Microsoft, Apple, etc.)
 */
export interface CalendarAdapter {
  /**
   * List calendar events within a time range
   * @param options - Query options for filtering events
   * @returns Array of calendar events
   */
  listEvents(options?: ListEventsOptions): Promise<CalendarEvent[]>;

  /**
   * Create a new calendar event
   * @param calendarId - Target calendar identifier
   * @param event - Event data to create
   * @returns Created event with assigned ID
   */
  createEvent(calendarId: string, event: Partial<CalendarEvent>): Promise<CalendarEvent>;

  /**
   * Update an existing calendar event
   * @param calendarId - Calendar identifier
   * @param eventId - Event ID to update
   * @param event - Updated event data
   * @returns Updated event
   */
  updateEvent(
    calendarId: string,
    eventId: string,
    event: Partial<CalendarEvent>
  ): Promise<CalendarEvent>;

  /**
   * Delete a calendar event
   * @param calendarId - Calendar identifier
   * @param eventId - Event ID to delete
   */
  deleteEvent(calendarId: string, eventId: string): Promise<void>;
}
