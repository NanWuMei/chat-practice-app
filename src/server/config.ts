import "dotenv/config";

export const config = {
  apiBase: process.env.MIMO_API_BASE ?? "https://token-plan-cn.xiaomimimo.com/v1",
  apiKey: process.env.MIMO_API_KEY ?? "",
  model: process.env.MIMO_MODEL ?? "MiMo-v2.5-pro",
  port: Number(process.env.PORT) || 8787,
};

if (!config.apiKey) {
  console.warn("⚠️  MIMO_API_KEY 未设置，AI 功能将不可用");
}