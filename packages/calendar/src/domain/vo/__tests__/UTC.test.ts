import { describe, it, expect } from "vitest";
import { UTC } from "../UTC";
import { InvalidUTCError } from "../../errors";

describe("UTC Value Object", () => {
  describe("Construction and Creation", () => {
    it("should create UTC from Date object", () => {
      const date = new Date("2025-01-15T10:30:00Z");
      const utc = UTC.fromDate(date);

      expect(utc).toBeInstanceOf(UTC);
      expect(utc.toDate()).toEqual(date);
    });

    it("should create UTC from ISO string", () => {
      const isoString = "2025-01-15T10:30:00.000Z";
      const utc = UTC.fromISO(isoString);

      expect(utc.toISO()).toBe(isoString);
    });

    it("should create UTC for current time", () => {
      const before = Date.now();
      const utc = UTC.now();
      const after = Date.now();

      const timestamp = utc.toDate().getTime();
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it("should create UTC from timestamp", () => {
      const timestamp = 1705318200000; // 2025-01-15T10:30:00Z
      const utc = UTC.fromTimestamp(timestamp);

      expect(utc.toTimestamp()).toBe(timestamp);
    });

    it("should throw on invalid ISO string", () => {
      expect(() => UTC.fromISO("invalid-date")).toThrow(InvalidUTCError);
      expect(() => UTC.fromISO("invalid-date")).toThrow("Invalid ISO date string");
    });

    it("should throw on empty ISO string", () => {
      expect(() => UTC.fromISO("")).toThrow(InvalidUTCError);
      expect(() => UTC.fromISO("")).toThrow("ISO date string cannot be empty");
    });
  });

  describe("Timezone Handling", () => {
    it("should store time in UTC regardless of input timezone", () => {
      // Create date with local timezone
      const localDate = new Date("2025-01-15T10:30:00");
      const utc = UTC.fromDate(localDate);

      // Should convert to UTC
      const isoString = utc.toISO();
      expect(isoString).toContain("Z"); // UTC indicator
    });

    it("should handle different timezone formats in ISO strings", () => {
      const utc1 = UTC.fromISO("2025-01-15T10:30:00Z");
      const utc2 = UTC.fromISO("2025-01-15T10:30:00.000Z");

      expect(utc1.toTimestamp()).toBe(utc2.toTimestamp());
    });
  });

  describe("Comparison Operations", () => {
    it("should compare UTC instances correctly", () => {
      const utc1 = UTC.fromISO("2025-01-15T10:00:00Z");
      const utc2 = UTC.fromISO("2025-01-15T11:00:00Z");

      expect(utc1.isBefore(utc2)).toBe(true);
      expect(utc2.isAfter(utc1)).toBe(true);
      expect(utc1.isBefore(utc1)).toBe(false);
    });

    it("should check equality", () => {
      const utc1 = UTC.fromISO("2025-01-15T10:30:00Z");
      const utc2 = UTC.fromISO("2025-01-15T10:30:00.000Z");
      const utc3 = UTC.fromISO("2025-01-15T10:30:01Z");

      expect(utc1.equals(utc2)).toBe(true);
      expect(utc1.equals(utc3)).toBe(false);
    });

    it("should check if UTC is in the past", () => {
      const pastUtc = UTC.fromISO("2020-01-01T00:00:00Z");
      const futureUtc = UTC.fromDate(new Date(Date.now() + 1000 * 60 * 60)); // 1 hour from now

      expect(pastUtc.isPast()).toBe(true);
      expect(futureUtc.isPast()).toBe(false);
    });

    it("should check if UTC is in the future", () => {
      const pastUtc = UTC.fromISO("2020-01-01T00:00:00Z");
      const futureUtc = UTC.fromDate(new Date(Date.now() + 1000 * 60 * 60)); // 1 hour from now

      expect(futureUtc.isFuture()).toBe(true);
      expect(pastUtc.isFuture()).toBe(false);
    });
  });

  describe("Arithmetic Operations", () => {
    it("should add minutes", () => {
      const utc = UTC.fromISO("2025-01-15T10:30:00Z");
      const added = utc.addMinutes(30);

      expect(added.toISO()).toBe("2025-01-15T11:00:00.000Z");
    });

    it("should subtract minutes", () => {
      const utc = UTC.fromISO("2025-01-15T11:00:00Z");
      const subtracted = utc.subtractMinutes(30);

      expect(subtracted.toISO()).toBe("2025-01-15T10:30:00.000Z");
    });

    it("should add hours", () => {
      const utc = UTC.fromISO("2025-01-15T10:00:00Z");
      const added = utc.addHours(2);

      expect(added.toISO()).toBe("2025-01-15T12:00:00.000Z");
    });

    it("should add days", () => {
      const utc = UTC.fromISO("2025-01-15T10:00:00Z");
      const added = utc.addDays(7);

      expect(added.toISO()).toBe("2025-01-22T10:00:00.000Z");
    });

    it("should handle negative values in arithmetic", () => {
      const utc = UTC.fromISO("2025-01-15T10:00:00Z");
      const result = utc.addMinutes(-30);

      expect(result.toISO()).toBe("2025-01-15T09:30:00.000Z");
    });
  });

  describe("Difference Calculations", () => {
    it("should calculate difference in milliseconds", () => {
      const utc1 = UTC.fromISO("2025-01-15T10:00:00Z");
      const utc2 = UTC.fromISO("2025-01-15T10:30:00Z");

      expect(utc2.diffInMilliseconds(utc1)).toBe(30 * 60 * 1000);
      expect(utc1.diffInMilliseconds(utc2)).toBe(-30 * 60 * 1000);
    });

    it("should calculate difference in minutes", () => {
      const utc1 = UTC.fromISO("2025-01-15T10:00:00Z");
      const utc2 = UTC.fromISO("2025-01-15T10:30:00Z");

      expect(utc2.diffInMinutes(utc1)).toBe(30);
      expect(utc1.diffInMinutes(utc2)).toBe(-30);
    });

    it("should calculate difference in hours", () => {
      const utc1 = UTC.fromISO("2025-01-15T10:00:00Z");
      const utc2 = UTC.fromISO("2025-01-15T13:00:00Z");

      expect(utc2.diffInHours(utc1)).toBe(3);
    });

    it("should calculate difference in days", () => {
      const utc1 = UTC.fromISO("2025-01-15T00:00:00Z");
      const utc2 = UTC.fromISO("2025-01-22T00:00:00Z");

      expect(utc2.diffInDays(utc1)).toBe(7);
    });
  });

  describe("Formatting", () => {
    it("should format to ISO string", () => {
      const utc = UTC.fromISO("2025-01-15T10:30:00Z");
      expect(utc.toISO()).toBe("2025-01-15T10:30:00.000Z");
    });

    it("should format to timestamp", () => {
      const timestamp = 1705318200000;
      const utc = UTC.fromTimestamp(timestamp);
      expect(utc.toTimestamp()).toBe(timestamp);
    });

    it("should format to Date object", () => {
      const date = new Date("2025-01-15T10:30:00Z");
      const utc = UTC.fromDate(date);
      expect(utc.toDate()).toEqual(date);
    });

    it("should have useful toString representation", () => {
      const utc = UTC.fromISO("2025-01-15T10:30:00Z");
      expect(utc.toString()).toBe("2025-01-15T10:30:00.000Z");
    });
  });

  describe("Immutability", () => {
    it("should not mutate original instance on arithmetic operations", () => {
      const original = UTC.fromISO("2025-01-15T10:00:00Z");
      const originalISO = original.toISO();

      original.addMinutes(30);
      original.addHours(2);
      original.addDays(1);

      expect(original.toISO()).toBe(originalISO);
    });

    it("should return new instance on all transformations", () => {
      const original = UTC.fromISO("2025-01-15T10:00:00Z");
      const modified = original.addMinutes(30);

      expect(modified).not.toBe(original);
      expect(modified).toBeInstanceOf(UTC);
    });
  });

  describe("Edge Cases", () => {
    it("should handle year boundaries", () => {
      const utc = UTC.fromISO("2024-12-31T23:30:00Z");
      const added = utc.addHours(1);

      expect(added.toISO()).toBe("2025-01-01T00:30:00.000Z");
    });

    it("should handle month boundaries", () => {
      const utc = UTC.fromISO("2025-01-31T23:00:00Z");
      const added = utc.addDays(1);

      expect(added.toISO()).toContain("2025-02-01");
    });

    it("should handle leap years", () => {
      const utc = UTC.fromISO("2024-02-28T00:00:00Z");
      const added = utc.addDays(1);

      expect(added.toISO()).toContain("2024-02-29"); // 2024 is a leap year
    });

    it("should handle very large time differences", () => {
      const utc1 = UTC.fromISO("2020-01-01T00:00:00Z");
      const utc2 = UTC.fromISO("2025-01-01T00:00:00Z");

      const days = utc2.diffInDays(utc1);
      expect(days).toBeGreaterThan(1800); // ~5 years
    });
  });

  describe("Serialization", () => {
    it("should serialize to JSON", () => {
      const utc = UTC.fromISO("2025-01-15T10:30:00Z");
      const json = JSON.parse(JSON.stringify({ time: utc })) as { time: string };

      expect(json.time).toBe("2025-01-15T10:30:00.000Z");
    });

    it("should support toJSON method", () => {
      const utc = UTC.fromISO("2025-01-15T10:30:00Z");
      expect(utc.toJSON()).toBe("2025-01-15T10:30:00.000Z");
    });
  });
});
