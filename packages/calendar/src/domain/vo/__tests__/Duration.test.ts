import { describe, it, expect } from "vitest";
import { Duration } from "../Duration";
import { InvalidDurationError } from "../../errors";

describe("Duration Value Object", () => {
  describe("Construction and Creation", () => {
    it("should create duration from minutes", () => {
      const duration = Duration.fromMinutes(30);

      expect(duration).toBeInstanceOf(Duration);
      expect(duration.toMinutes()).toBe(30);
    });

    it("should use 15 minutes as default", () => {
      const duration = Duration.default();

      expect(duration.toMinutes()).toBe(15);
    });

    it("should create duration from hours", () => {
      const duration = Duration.fromHours(2);

      expect(duration.toMinutes()).toBe(120);
    });

    it("should create duration from hours with decimal", () => {
      const duration = Duration.fromHours(1.5);

      expect(duration.toMinutes()).toBe(90);
    });

    it("should throw on negative minutes", () => {
      expect(() => Duration.fromMinutes(-10)).toThrow(InvalidDurationError);
      expect(() => Duration.fromMinutes(-10)).toThrow("Duration cannot be negative");
    });

    it("should throw on zero duration", () => {
      expect(() => Duration.fromMinutes(0)).toThrow(InvalidDurationError);
      expect(() => Duration.fromMinutes(0)).toThrow("Duration must be greater than zero");
    });

    it("should throw on very large duration (> 24 hours)", () => {
      expect(() => Duration.fromMinutes(24 * 60 + 1)).toThrow(InvalidDurationError);
      expect(() => Duration.fromMinutes(24 * 60 + 1)).toThrow("Duration cannot exceed 24 hours");
    });

    it("should allow exactly 24 hours", () => {
      const duration = Duration.fromMinutes(24 * 60);
      expect(duration.toMinutes()).toBe(24 * 60);
    });
  });

  describe("Comparison Operations", () => {
    it("should compare durations correctly", () => {
      const short = Duration.fromMinutes(15);
      const long = Duration.fromMinutes(60);

      expect(short.isShorterThan(long)).toBe(true);
      expect(long.isLongerThan(short)).toBe(true);
      expect(short.isShorterThan(short)).toBe(false);
    });

    it("should check equality", () => {
      const d1 = Duration.fromMinutes(30);
      const d2 = Duration.fromMinutes(30);
      const d3 = Duration.fromMinutes(60);

      expect(d1.equals(d2)).toBe(true);
      expect(d1.equals(d3)).toBe(false);
    });

    it("should check if duration is default (15 min)", () => {
      const defaultDuration = Duration.default();
      const customDuration = Duration.fromMinutes(30);

      expect(defaultDuration.isDefault()).toBe(true);
      expect(customDuration.isDefault()).toBe(false);
    });
  });

  describe("Arithmetic Operations", () => {
    it("should add durations", () => {
      const d1 = Duration.fromMinutes(30);
      const d2 = Duration.fromMinutes(45);
      const result = d1.add(d2);

      expect(result.toMinutes()).toBe(75);
    });

    it("should subtract durations", () => {
      const d1 = Duration.fromMinutes(60);
      const d2 = Duration.fromMinutes(15);
      const result = d1.subtract(d2);

      expect(result.toMinutes()).toBe(45);
    });

    it("should throw when subtraction results in negative duration", () => {
      const d1 = Duration.fromMinutes(15);
      const d2 = Duration.fromMinutes(30);

      expect(() => d1.subtract(d2)).toThrow(InvalidDurationError);
      expect(() => d1.subtract(d2)).toThrow("Duration cannot be negative");
    });

    it("should multiply duration", () => {
      const duration = Duration.fromMinutes(15);
      const result = duration.multiply(3);

      expect(result.toMinutes()).toBe(45);
    });

    it("should throw when multiplication exceeds 24 hours", () => {
      const duration = Duration.fromHours(12);

      expect(() => duration.multiply(3)).toThrow(InvalidDurationError);
      expect(() => duration.multiply(3)).toThrow("Duration cannot exceed 24 hours");
    });

    it("should divide duration", () => {
      const duration = Duration.fromMinutes(60);
      const result = duration.divide(4);

      expect(result.toMinutes()).toBe(15);
    });

    it("should throw when division results in zero", () => {
      const duration = Duration.fromMinutes(15);

      expect(() => duration.divide(100)).toThrow(InvalidDurationError);
      expect(() => duration.divide(100)).toThrow("Duration must be greater than zero");
    });
  });

  describe("Formatting", () => {
    it("should format to minutes", () => {
      const duration = Duration.fromMinutes(45);
      expect(duration.toMinutes()).toBe(45);
    });

    it("should format to hours", () => {
      const duration = Duration.fromMinutes(90);
      expect(duration.toHours()).toBe(1.5);
    });

    it("should format to milliseconds", () => {
      const duration = Duration.fromMinutes(1);
      expect(duration.toMilliseconds()).toBe(60 * 1000);
    });

    it("should format to human-readable string (minutes only)", () => {
      const duration = Duration.fromMinutes(30);
      expect(duration.toHumanString()).toBe("30 minutes");
    });

    it("should format to human-readable string (1 minute)", () => {
      const duration = Duration.fromMinutes(1);
      expect(duration.toHumanString()).toBe("1 minute");
    });

    it("should format to human-readable string (hours and minutes)", () => {
      const duration = Duration.fromMinutes(90);
      expect(duration.toHumanString()).toBe("1 hour 30 minutes");
    });

    it("should format to human-readable string (hours only)", () => {
      const duration = Duration.fromMinutes(120);
      expect(duration.toHumanString()).toBe("2 hours");
    });

    it("should format to human-readable string (1 hour)", () => {
      const duration = Duration.fromMinutes(60);
      expect(duration.toHumanString()).toBe("1 hour");
    });

    it("should use toString for display", () => {
      const duration = Duration.fromMinutes(45);
      expect(duration.toString()).toBe("45 minutes");
    });
  });

  describe("Common Durations", () => {
    it("should have predefined 15-minute duration", () => {
      const duration = Duration.minutes15();
      expect(duration.toMinutes()).toBe(15);
    });

    it("should have predefined 30-minute duration", () => {
      const duration = Duration.minutes30();
      expect(duration.toMinutes()).toBe(30);
    });

    it("should have predefined 1-hour duration", () => {
      const duration = Duration.hours1();
      expect(duration.toMinutes()).toBe(60);
    });

    it("should have predefined 2-hour duration", () => {
      const duration = Duration.hours2();
      expect(duration.toMinutes()).toBe(120);
    });
  });

  describe("Immutability", () => {
    it("should not mutate original instance on add", () => {
      const original = Duration.fromMinutes(30);
      const originalMinutes = original.toMinutes();

      original.add(Duration.fromMinutes(15));

      expect(original.toMinutes()).toBe(originalMinutes);
    });

    it("should not mutate original instance on subtract", () => {
      const original = Duration.fromMinutes(60);
      const originalMinutes = original.toMinutes();

      original.subtract(Duration.fromMinutes(15));

      expect(original.toMinutes()).toBe(originalMinutes);
    });

    it("should return new instance on all transformations", () => {
      const original = Duration.fromMinutes(30);
      const modified = original.multiply(2);

      expect(modified).not.toBe(original);
      expect(modified).toBeInstanceOf(Duration);
    });
  });

  describe("Edge Cases", () => {
    it("should handle 1 minute duration", () => {
      const duration = Duration.fromMinutes(1);
      expect(duration.toMinutes()).toBe(1);
      expect(duration.toHumanString()).toBe("1 minute");
    });

    it("should handle 24 hour (maximum) duration", () => {
      const duration = Duration.fromHours(24);
      expect(duration.toHours()).toBe(24);
      expect(duration.toHumanString()).toBe("24 hours");
    });

    it("should round down when dividing", () => {
      const duration = Duration.fromMinutes(10);
      const result = duration.divide(3);

      expect(result.toMinutes()).toBe(3); // 10/3 = 3.33 rounded down
    });
  });

  describe("Serialization", () => {
    it("should serialize to JSON as minutes", () => {
      const duration = Duration.fromMinutes(45);
      const json = JSON.parse(JSON.stringify({ duration })) as { duration: number };

      expect(json.duration).toBe(45);
    });

    it("should support toJSON method", () => {
      const duration = Duration.fromMinutes(30);
      expect(duration.toJSON()).toBe(30);
    });

    it("should recreate from JSON", () => {
      const original = Duration.fromMinutes(90);
      const json = original.toJSON();
      const recreated = Duration.fromMinutes(json);

      expect(recreated.equals(original)).toBe(true);
    });
  });
});
