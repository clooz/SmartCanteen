// 统一 API 响应格式
const success = (res, data = null, message = 'ok', statusCode = 200) => {
  return res.status(statusCode).json({
    code: 0,
    message,
    data,
  });
};

const fail = (res, message = '请求失败', statusCode = 400, code = 1) => {
  return res.status(statusCode).json({
    code,
    message,
    data: null,
  });
};

module.exports = { success, fail };
