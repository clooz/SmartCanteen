/**
 * 订餐窗口：全局默认 + 按日菜单覆盖；override 为 open/closed 时覆盖自动时间判断。
 */

function pad2(n) {
  return String(n).padStart(2, '0');
}

function localDateStr(d = new Date()) {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
}

function mysqlTimeToHHMMSS(t) {
  if (t == null || t === '') return null;
  if (typeof t === 'string') {
    const m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (m) {
      const h = m[1].padStart(2, '0');
      const mi = m[2];
      const s = m[3] != null ? m[3].padStart(2, '0') : '00';
      return `${h}:${mi}:${s}`;
    }
  }
  if (typeof t === 'object' && t !== null && typeof t.getHours === 'function') {
    return `${pad2(t.getHours())}:${pad2(t.getMinutes())}:${pad2(t.getSeconds())}`;
  }
  return null;
}

function parseMenuDateToStr(menuDate) {
  if (!menuDate) return null;
  if (typeof menuDate === 'string') return menuDate.slice(0, 10);
  if (menuDate instanceof Date) return localDateStr(menuDate);
  return String(menuDate).slice(0, 10);
}

function buildLocalDateTime(dateStr, timeHHMMSS) {
  if (!dateStr || !timeHHMMSS) return null;
  const ds = dateStr.slice(0, 10);
  const parts = timeHHMMSS.split(':');
  const h = parseInt(parts[0], 10);
  const mi = parseInt(parts[1], 10);
  const s = parts[2] != null ? parseInt(parts[2], 10) : 0;
  const [y, mo, d] = ds.split('-').map((x) => parseInt(x, 10));
  if ([y, mo, d, h, mi, s].some((n) => Number.isNaN(n))) return null;
  return new Date(y, mo - 1, d, h, mi, s, 0);
}

function getEffectiveMealTimes(menu, settings, mealType) {
  const isBf = mealType === 'breakfast';
  const mStart = isBf ? menu.breakfast_order_start : menu.lunch_order_start;
  const mEnd = isBf ? menu.breakfast_order_end : menu.lunch_order_end;
  const gStart = isBf ? settings.breakfast_order_start : settings.lunch_order_start;
  const gEnd = isBf ? settings.breakfast_order_end : settings.lunch_order_end;
  const start = mysqlTimeToHHMMSS(mStart != null ? mStart : gStart);
  const end = mysqlTimeToHHMMSS(mEnd != null ? mEnd : gEnd);
  return { start, end };
}

function getOverride(menu, mealType) {
  const v = mealType === 'breakfast' ? menu.breakfast_ordering_override : menu.lunch_ordering_override;
  if (v === 'open' || v === 'closed' || v === 'auto') return v;
  return 'auto';
}

function formatWindowLabel(start, end) {
  if (!start || !end) return '';
  return `${start.slice(0, 5)}–${end.slice(0, 5)}`;
}

/**
 * @param {object} menu daily_menus 行
 * @param {object} settings kitchen_ordering_settings 行
 * @param {'breakfast'|'lunch'} mealType
 * @param {Date} [now]
 */
function evaluateMealOrdering(menu, settings, mealType, now = new Date()) {
  const override = getOverride(menu, mealType);
  const dateStr = parseMenuDateToStr(menu.menu_date);
  const { start, end } = getEffectiveMealTimes(menu, settings, mealType);

  if (override === 'open') {
    return {
      accepting: true,
      reasonCode: 'override_open',
      reasonText: '管理员已强制开启订餐',
      windowStart: start,
      windowEnd: end,
      override,
    };
  }
  if (override === 'closed') {
    return {
      accepting: false,
      reasonCode: 'override_closed',
      reasonText: '该餐次已暂停订餐',
      windowStart: start,
      windowEnd: end,
      override,
    };
  }

  if (!start || !end) {
    return {
      accepting: false,
      reasonCode: 'no_window',
      reasonText: '未配置订餐时段，暂时无法下单',
      windowStart: start,
      windowEnd: end,
      override,
    };
  }

  const tStart = buildLocalDateTime(dateStr, start);
  const tEnd = buildLocalDateTime(dateStr, end);
  if (!tStart || !tEnd) {
    return {
      accepting: false,
      reasonCode: 'invalid_window',
      reasonText: '订餐时段配置无效',
      windowStart: start,
      windowEnd: end,
      override,
    };
  }
  if (tEnd <= tStart) {
    return {
      accepting: false,
      reasonCode: 'invalid_range',
      reasonText: '订餐结束时间需晚于开始时间',
      windowStart: start,
      windowEnd: end,
      override,
    };
  }

  if (now < tStart) {
    return {
      accepting: false,
      reasonCode: 'not_started',
      reasonText: `订餐将于 ${start.slice(0, 5)} 开始`,
      windowStart: start,
      windowEnd: end,
      override,
    };
  }
  if (now > tEnd) {
    return {
      accepting: false,
      reasonCode: 'ended',
      reasonText: `订餐已于 ${end.slice(0, 5)} 结束`,
      windowStart: start,
      windowEnd: end,
      override,
    };
  }

  return {
    accepting: true,
    reasonCode: 'in_window',
    reasonText: '',
    windowStart: start,
    windowEnd: end,
    override,
  };
}

function buildOrderingSummary(menu, settings, now = new Date()) {
  const bf = evaluateMealOrdering(menu, settings, 'breakfast', now);
  const lu = evaluateMealOrdering(menu, settings, 'lunch', now);
  return {
    breakfast: {
      accepting: bf.accepting,
      reasonCode: bf.reasonCode,
      override: bf.override,
      window: formatWindowLabel(bf.windowStart, bf.windowEnd),
      message: bf.accepting ? '' : bf.reasonText,
    },
    lunch: {
      accepting: lu.accepting,
      reasonCode: lu.reasonCode,
      override: lu.override,
      window: formatWindowLabel(lu.windowStart, lu.windowEnd),
      message: lu.accepting ? '' : lu.reasonText,
    },
  };
}

function normalizeTimeForDb(val) {
  if (val === undefined) return undefined;
  if (val === null || val === '') return null;
  const s = String(val).trim();
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  if (/^\d{2}:\d{2}:\d{2}/.test(s)) return s.slice(0, 8);
  return null;
}

function normalizeOverride(val) {
  if (val === undefined) return undefined;
  if (val === 'open' || val === 'closed' || val === 'auto') return val;
  return 'auto';
}

module.exports = {
  localDateStr,
  evaluateMealOrdering,
  buildOrderingSummary,
  normalizeTimeForDb,
  normalizeOverride,
  mysqlTimeToHHMMSS,
};
