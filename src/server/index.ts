import "dotenv/config";
import express from "express";
import cors from "cors";
import { config } from "./config";
import router from "./routes";

const app = express();
app.use(cors());
app.use(express.json());
app.use(router);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), model: config.model });
});

app.listen(config.port, () => {
  console.log(`\n🚀 聊天训练 API 已启动：http://localhost:${config.port}`);
  console.log(`   GET  /api/health`);
  console.log(`   GET  /api/personas`);
  console.log(`   GET  /api/mentors`);
  console.log(`   POST /api/sessions`);
  console.log(`   POST /api/sessions/:id/messages`);
  console.log(`   GET  /api/sessions/:id/messages`);
  console.log(`   POST /api/sessions/:id/review`);
  console.log(`   GET  /api/sessions/:id/review\n`);
});
