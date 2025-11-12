# @systeric/calendar

Extensible calendar service with support for multiple providers via adapter pattern.

## Technical Plan

**Purpose**: Provide a clean, type-safe interface for calendar operations with proper error handling, UTC timezone support, and multi-provider extensibility.

**Design Principles**:

- Adapter pattern for extensibility (easy to add new providers)
- Single responsibility: Calendar operations only
- Type-safe with Zod schemas
- Support for CRUD operations on calendar events
- 14-day time window support for sync operations
- UTC-first timezone handling

**Current Providers**:

- Google Calendar (via `GoogleCalendarAdapter`)

**Future Provider Support**:

- Microsoft Outlook Calendar
- Apple Calendar (CalDAV)
- Office 365
- CalDAV-compatible calendars

## Architecture

The package uses the **Adapter Pattern** to support multiple calendar providers:

```typescript
CalendarAdapter (interface)
    ↑
    ├── GoogleCalendarAdapter
    ├── OutlookAdapter (future)
    └── AppleCalendarAdapter (future)

CalendarService accepts any CalendarAdapter implementation
```

## API Contract

### `CalendarAdapter` (Interface)

All calendar adapters must implement this interface.

```typescript
interface CalendarAdapter {
  listEvents(options?: ListEventsOptions): Promise<CalendarEvent[]>;
  createEvent(calendarId: string, event: Partial<CalendarEvent>): Promise<CalendarEvent>;
  updateEvent(
    calendarId: string,
    eventId: string,
    event: Partial<CalendarEvent>
  ): Promise<CalendarEvent>;
  deleteEvent(calendarId: string, eventId: string): Promise<void>;
}
```

### `GoogleCalendarAdapter`

Adapter for Google Calendar API.

#### Constructor

```typescript
constructor(accessToken: string)
```

**Parameters**:

- `accessToken` (string): Google OAuth2 access token

**Example**:

```typescript
import { GoogleCalendarAdapter } from "@systeric/calendar";

const adapter = new GoogleCalendarAdapter(accessToken);
```

### `CalendarService`

Main service class that delegates to a calendar adapter.

#### Constructor

```typescript
constructor(adapter: CalendarAdapter)
```

**Parameters**:

- `adapter` (CalendarAdapter): Calendar adapter implementation

**Example**:

```typescript
import { CalendarService, GoogleCalendarAdapter } from "@systeric/calendar";

const adapter = new GoogleCalendarAdapter(accessToken);
const calendarService = new CalendarService(adapter);
```

#### Methods

##### `listEvents(options?: ListEventsOptions): Promise<CalendarEvent[]>`

List calendar events within a time range.

**Parameters**:

- `options` (ListEventsOptions, optional):
  - `calendarId` (string, default: 'primary'): Calendar ID to query
  - `timeMin` (string, optional): RFC3339 timestamp (ISO 8601)
  - `timeMax` (string, optional): RFC3339 timestamp (ISO 8601)
  - `maxResults` (number, default: 100): Maximum events to return

**Returns**: `Promise<CalendarEvent[]>`

**Example**:

```typescript
// Get events for next 14 days
const now = new Date().toISOString();
const twoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

const events = await calendarService.listEvents({
  timeMin: now,
  timeMax: twoWeeks,
  maxResults: 50,
});
```

##### `createEvent(calendarId: string, event: Partial<CalendarEvent>): Promise<CalendarEvent>`

Create a new calendar event.

**Parameters**:

- `calendarId` (string): Target calendar ID
- `event` (Partial<CalendarEvent>): Event data
  - `summary` (string): Event title
  - `description` (string, optional): Event description
  - `start` (object): Start time
    - `dateTime` (string): ISO 8601 datetime
    - `date` (string): Date only (all-day events)
  - `end` (object): End time (same structure as start)

**Returns**: `Promise<CalendarEvent>` - Created event with ID

**Example**:

```typescript
const event = await calendarService.createEvent("primary", {
  summary: "Team Meeting",
  description: "Weekly sync",
  start: {
    dateTime: "2025-10-20T10:00:00Z",
  },
  end: {
    dateTime: "2025-10-20T11:00:00Z",
  },
});
```

##### `updateEvent(calendarId: string, eventId: string, event: Partial<CalendarEvent>): Promise<CalendarEvent>`

Update an existing calendar event.

**Parameters**:

- `calendarId` (string): Calendar ID
- `eventId` (string): Event ID to update
- `event` (Partial<CalendarEvent>): Updated event data

**Returns**: `Promise<CalendarEvent>` - Updated event

**Example**:

```typescript
const updated = await calendarService.updateEvent("primary", "event123", {
  summary: "Team Meeting (Updated)",
  start: {
    dateTime: "2025-10-20T14:00:00Z",
  },
  end: {
    dateTime: "2025-10-20T15:00:00Z",
  },
});
```

##### `deleteEvent(calendarId: string, eventId: string): Promise<void>`

Delete a calendar event.

**Parameters**:

- `calendarId` (string): Calendar ID
- `eventId` (string): Event ID to delete

**Returns**: `Promise<void>`

**Example**:

```typescript
await calendarService.deleteEvent("primary", "event123");
```

## Usage

### Installation

```bash
pnpm add @systeric/calendar
```

### Basic Example with Google Calendar

```typescript
import { CalendarService, GoogleCalendarAdapter } from "@systeric/calendar";

// Create adapter
const adapter = new GoogleCalendarAdapter(accessToken);

// Initialize service with adapter
const calendarService = new CalendarService(adapter);

// List upcoming events
const events = await calendarService.listEvents({
  timeMin: new Date().toISOString(),
  maxResults: 10,
});

console.log(`Found ${events.length} events`);

// Create a new event
const newEvent = await calendarService.createEvent("primary", {
  summary: "Focus Time",
  start: { dateTime: "2025-10-21T09:00:00Z" },
  end: { dateTime: "2025-10-21T10:00:00Z" },
});

console.log("Created event:", newEvent.id);
```

### Creating a Custom Adapter

You can create your own adapter for any calendar provider by implementing the `CalendarAdapter` interface:

```typescript
import { CalendarAdapter, CalendarEvent, ListEventsOptions } from "@systeric/calendar";
import { Client } from "@microsoft/microsoft-graph-client";

export class OutlookAdapter implements CalendarAdapter {
  private client: Client;

  constructor(accessToken: string) {
    this.client = Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      },
    });
  }

  async listEvents(options: ListEventsOptions = {}): Promise<CalendarEvent[]> {
    const response = await this.client
      .api("/me/calendar/events")
      .filter(`start/dateTime ge '${options.timeMin}' and end/dateTime le '${options.timeMax}'`)
      .top(options.maxResults || 100)
      .get();

    return response.value.map((event: any) => ({
      id: event.id,
      summary: event.subject,
      description: event.body?.content,
      start: { dateTime: event.start.dateTime },
      end: { dateTime: event.end.dateTime },
    }));
  }

  async createEvent(calendarId: string, event: Partial<CalendarEvent>): Promise<CalendarEvent> {
    const response = await this.client.api("/me/calendar/events").post({
      subject: event.summary,
      body: { content: event.description, contentType: "text" },
      start: { dateTime: event.start?.dateTime, timeZone: "UTC" },
      end: { dateTime: event.end?.dateTime, timeZone: "UTC" },
    });

    return {
      id: response.id,
      summary: response.subject,
      description: response.body?.content,
      start: { dateTime: response.start.dateTime },
      end: { dateTime: response.end.dateTime },
    };
  }

  async updateEvent(
    calendarId: string,
    eventId: string,
    event: Partial<CalendarEvent>
  ): Promise<CalendarEvent> {
    const response = await this.client.api(`/me/calendar/events/${eventId}`).patch({
      subject: event.summary,
      body: event.description ? { content: event.description, contentType: "text" } : undefined,
      start: event.start ? { dateTime: event.start.dateTime, timeZone: "UTC" } : undefined,
      end: event.end ? { dateTime: event.end.dateTime, timeZone: "UTC" } : undefined,
    });

    return {
      id: response.id,
      summary: response.subject,
      description: response.body?.content,
      start: { dateTime: response.start.dateTime },
      end: { dateTime: response.end.dateTime },
    };
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    await this.client.api(`/me/calendar/events/${eventId}`).delete();
  }
}

// Usage
const outlookAdapter = new OutlookAdapter(accessToken);
const calendarService = new CalendarService(outlookAdapter);
```

### 14-Day Sync Window Example

```typescript
// Sync events within 14 days past and 14 days future
const now = new Date();
const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
const fourteenDaysLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

const events = await calendarService.listEvents({
  timeMin: fourteenDaysAgo.toISOString(),
  timeMax: fourteenDaysLater.toISOString(),
});
```

### UTC Timezone Handling

All datetime values should be in UTC (ISO 8601 format with 'Z' suffix):

```typescript
// ✅ Correct: UTC timestamp
const event = await calendarService.createEvent("primary", {
  summary: "Meeting",
  start: { dateTime: "2025-10-20T10:00:00Z" },
  end: { dateTime: "2025-10-20T11:00:00Z" },
});

// ❌ Incorrect: Local timezone
// Don't use local timezones - convert to UTC first
```

## Types

### `CalendarEvent`

```typescript
interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string; // ISO 8601
    date?: string; // YYYY-MM-DD for all-day events
  };
  end: {
    dateTime?: string;
    date?: string;
  };
}
```

### `ListEventsOptions`

```typescript
interface ListEventsOptions {
  calendarId?: string; // Default: 'primary'
  timeMin?: string; // ISO 8601
  timeMax?: string; // ISO 8601
  maxResults?: number; // Default: 100
}
```

## Development

```bash
# Build
pnpm build

# Test
pnpm test

# Lint
pnpm lint

# Type check
pnpm typecheck
```

## License

Private - Systeric Internal Use
