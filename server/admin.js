import dotenv from 'dotenv';
import { initDb } from './lib/db.js';
import { setProStatus, getUserById } from './lib/users.js';

dotenv.config();
initDb();

function usage() {
  console.log(`
用法：
  node server/admin.js set-pro --userId <数字> --on
  node server/admin.js set-pro --userId <数字> --off

示例：
  node server/admin.js set-pro --userId 12 --on
`);
}

function getArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

const cmd = process.argv[2];
if (!cmd) {
  usage();
  process.exit(1);
}

if (cmd !== 'set-pro') {
  console.error('未知命令:', cmd);
  usage();
  process.exit(1);
}

const userIdRaw = getArg('--userId');
const on = process.argv.includes('--on');
const off = process.argv.includes('--off');

if (!userIdRaw) {
  console.error('缺少 --userId');
  usage();
  process.exit(1);
}

if ((on && off) || (!on && !off)) {
  console.error('请指定 --on 或 --off');
  usage();
  process.exit(1);
}

const userId = Number(userIdRaw);
if (!Number.isFinite(userId) || userId <= 0) {
  console.error('userId 必须是正整数');
  process.exit(1);
}

const isPro = on;

try {
  const updated = await setProStatus({ userId, isPro });
  if (!updated) {
    console.error('未找到用户:', userId);
    process.exit(2);
  }
  const user = await getUserById(userId);
  console.log('已更新:', { id: user.id, username: user.username, isPro: Boolean(user.isPro) });
} catch (e) {
  console.error('操作失败:', e?.message || e);
  process.exit(3);
}
