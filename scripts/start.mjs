#!/usr/bin/env node
import { existsSync, copyFileSync } from 'fs';
import { execSync } from 'child_process';

// 1. 自动创建 .env
if (!existsSync('.env')) {
  if (existsSync('.env.example')) {
    copyFileSync('.env.example', '.env');
    console.log('✅ 已从 .env.example 创建 .env，请编辑填入你的 MIMO_API_KEY');
  }
}

// 2. 检查 node_modules
if (!existsSync('node_modules')) {
  console.log('📦 安装依赖...');
  execSync('npm install', { stdio: 'inherit' });
}

// 3. 启动
console.log('\n🚀 启动镜子...\n');
execSync('npx concurrently "npx tsx watch src/server/index.ts" "npx vite"', { stdio: 'inherit' });