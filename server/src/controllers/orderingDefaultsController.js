const { success, fail } = require('../utils/response');
const { getKitchenOrderingSettings, updateKitchenOrderingSettings } = require('../services/kitchenOrderingSettings');

function toMysqlTime(val) {
  if (val == null || val === '') return null;
  const s = String(val).trim();
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  if (/^\d{2}:\d{2}:\d{2}/.test(s)) return s.slice(0, 8);
  return s;
}

const getOrderingDefaults = async (req, res) => {
  try {
    const row = await getKitchenOrderingSettings();
    return success(res, row);
  } catch (err) {
    console.error('getOrderingDefaults error:', err);
    return fail(res, '服务器错误', 500);
  }
};

const updateOrderingDefaults = async (req, res) => {
  try {
    const body = req.body || {};
    const required = ['breakfast_order_start', 'breakfast_order_end', 'lunch_order_start', 'lunch_order_end'];
    for (const k of required) {
      if (!Object.prototype.hasOwnProperty.call(body, k)) {
        return fail(res, `缺少字段：${k}`);
      }
      if (body[k] === '' || body[k] == null) {
        return fail(res, '全局订餐时段不能为空');
      }
    }
    const row = await updateKitchenOrderingSettings({
      breakfast_order_start: toMysqlTime(body.breakfast_order_start),
      breakfast_order_end: toMysqlTime(body.breakfast_order_end),
      lunch_order_start: toMysqlTime(body.lunch_order_start),
      lunch_order_end: toMysqlTime(body.lunch_order_end),
    });
    return success(res, row, '全局默认订餐时段已保存');
  } catch (err) {
    console.error('updateOrderingDefaults error:', err);
    return fail(res, '服务器错误', 500);
  }
};

module.exports = { getOrderingDefaults, updateOrderingDefaults };
