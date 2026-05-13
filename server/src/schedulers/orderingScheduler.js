const { pool } = require('../db/connection');
const { localDateStr } = require('../utils/orderingRules');

async function syncMenuLifecycle(now = new Date()) {
  const today = localDateStr(now);

  const [publishResult] = await pool.query(
    "UPDATE daily_menus SET status = 'published' WHERE menu_date = ? AND status = 'draft'",
    [today]
  );
  const [closeResult] = await pool.query(
    "UPDATE daily_menus SET status = 'closed' WHERE menu_date < ? AND status IN ('draft', 'published')",
    [today]
  );

  const published = publishResult.affectedRows || 0;
  const closed = closeResult.affectedRows || 0;
  if (published || closed) {
    console.log(`菜单状态已同步：自动发布 ${published} 个，自动关闭 ${closed} 个`);
  }

  return { published, closed };
}

function runMenuLifecycleSync() {
  syncMenuLifecycle().catch((err) => {
    console.error('菜单状态自动同步失败:', err.message);
  });
}

/**
 * 订餐窗口仍以请求时刻计算；菜单生命周期按日期自动发布/关闭。
 */
function startOrderingScheduler() {
  const intervalMs = 60_000;
  runMenuLifecycleSync();
  setInterval(runMenuLifecycleSync, intervalMs);
  console.log(`菜单状态调度已启动（每 ${intervalMs / 1000}s 检查一次）`);
}

module.exports = { startOrderingScheduler, syncMenuLifecycle };
