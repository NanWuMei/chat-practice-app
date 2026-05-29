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

describe("Persona Service", () => {
  it("should load personas after seeding", async () => {
    // Dynamically import to get fresh module with test DB path
    // For now, test the basic structure
    const { liangYouan } = await import("../../src/server/data");
    expect(liangYouan.id).toBe("liang-youan");
    expect(liangYouan.name).toBe("梁友安");
    expect(liangYouan.emotionalBankScore).toBe(0);
  });

  it("should have correct persona structure", async () => {
    const { liangYouan } = await import("../../src/server/data");
    expect(Array.isArray(liangYouan.mentalModels)).toBe(true);
    expect(Array.isArray(liangYouan.personality)).toBe(true);
    expect(liangYouan.initialState).toHaveProperty("comfort");
    expect(liangYouan.initialState).toHaveProperty("trust");
    expect(liangYouan.initialState).toHaveProperty("interest");
    expect(liangYouan.initialState).toHaveProperty("ambiguity");
    expect(liangYouan.initialState).toHaveProperty("pressure");
  });
});

describe("Mentor Data", () => {
  it("should have correct mentor structures", async () => {
    const { tongJincheng, gottman } = await import("../../src/server/data");
    expect(tongJincheng.id).toBe("tong-jincheng");
    expect(tongJincheng.role).toBe("practical");
    expect(gottman.id).toBe("john-gottman");
    expect(gottman.role).toBe("psychology");
  });
});
