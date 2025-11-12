import { google } from "googleapis";
import type { CalendarAdapter, CalendarEvent, ListEventsOptions } from "../types";
import { CalendarEventSchema } from "../types";

export class GoogleCalendarAdapter implements CalendarAdapter {
  private calendar;

  constructor(accessToken: string) {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    this.calendar = google.calendar({ version: "v3", auth });
  }

  async listEvents(options: ListEventsOptions = {}): Promise<CalendarEvent[]> {
    const { calendarId = "primary", timeMin, timeMax, maxResults = 100 } = options;

    const response = await this.calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      maxResults,
      singleEvents: true,
      orderBy: "startTime",
    });

    return CalendarEventSchema.array().parse(response.data.items || []);
  }

  async createEvent(calendarId: string, event: Partial<CalendarEvent>): Promise<CalendarEvent> {
    const response = await this.calendar.events.insert({
      calendarId,
      requestBody: event,
    });

    return CalendarEventSchema.parse(response.data);
  }

  async updateEvent(
    calendarId: string,
    eventId: string,
    event: Partial<CalendarEvent>
  ): Promise<CalendarEvent> {
    const response = await this.calendar.events.update({
      calendarId,
      eventId,
      requestBody: event,
    });

    return CalendarEventSchema.parse(response.data);
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    await this.calendar.events.delete({
      calendarId,
      eventId,
    });
  }
}
