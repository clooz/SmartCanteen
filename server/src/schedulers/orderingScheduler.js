/**
 * 订餐是否开放以请求时刻计算为准；此定时器预留扩展（如推送、统计）。
 */
function startOrderingScheduler() {
  const intervalMs = 60_000;
  setInterval(() => {
    /* no-op */
  }, intervalMs);
  console.log(`⏱️ 订餐调度占位已启动（每 ${intervalMs / 1000}s，判定在接口内实时计算）`);
}

module.exports = { startOrderingScheduler };
