import type { CalendarAdapter, CalendarEvent, ListEventsOptions } from "./types";

/**
 * CalendarService - Provider-agnostic calendar service
 *
 * Uses the adapter pattern to support multiple calendar providers.
 * Currently supports: Google Calendar
 * Future: Microsoft Outlook, Apple Calendar, CalDAV, etc.
 */
export class CalendarService {
  private adapter: CalendarAdapter;

  constructor(adapter: CalendarAdapter) {
    this.adapter = adapter;
  }

  async listEvents(options?: ListEventsOptions): Promise<CalendarEvent[]> {
    return this.adapter.listEvents(options);
  }

  async createEvent(calendarId: string, event: Partial<CalendarEvent>): Promise<CalendarEvent> {
    return this.adapter.createEvent(calendarId, event);
  }

  async updateEvent(
    calendarId: string,
    eventId: string,
    event: Partial<CalendarEvent>
  ): Promise<CalendarEvent> {
    return this.adapter.updateEvent(calendarId, eventId, event);
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    return this.adapter.deleteEvent(calendarId, eventId);
  }
}
