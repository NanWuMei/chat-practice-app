import { describe, expect, it, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Override DB path for testing
const TEST_DATA_DIR = path.join(process.cwd(), "data-test");
process.env.SQLITE_DB_PATH = path.join(TEST_DATA_DIR, "test.db");

// Clean up test data before/after tests
beforeAll(() => {
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true });
  }
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
});

afterAll(() => {
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true });
  }
});

describe("Persona Data", () => {
  it("should have correct persona structure", async () => {
    const { liangYouan } = await import("../../src/server/data");
    expect(liangYouan.id).toBe("liang-youan");
    expect(liangYouan.name).toBe("梁友安");
    expect(liangYouan.role).toContain("27岁");
    expect(liangYouan.role).toContain("体育经纪人");
    expect(Array.isArray(liangYouan.mentalModels)).toBe(true);
    expect(Array.isArray(liangYouan.personality)).toBe(true);
    expect(liangYouan.communication).toHaveProperty("avg_message_length_baseline");
  });

  it("should have psychology and communication fields", async () => {
    const { liangYouan } = await import("../../src/server/data");
    expect(liangYouan.psychology).toBeDefined();
    expect(liangYouan.psychology.attachment_style).toBeTruthy();
    expect(liangYouan.psychology.emotion_expression).toBeTruthy();
    expect(liangYouan.communication).toBeDefined();
    expect(Array.isArray(liangYouan.communication.energy_topics)).toBe(true);
    expect(Array.isArray(liangYouan.communication.sensitive_topics)).toBe(true);
    expect(liangYouan.communication.rhythm_preference).toBeTruthy();
  });

  it("should have known_patterns and meta fields", async () => {
    const { liangYouan } = await import("../../src/server/data");
    expect(Array.isArray(liangYouan.known_patterns)).toBe(true);
    expect(liangYouan.meta).toBeDefined();
    expect(liangYouan.meta.session_count).toBe(0);
  });
});
