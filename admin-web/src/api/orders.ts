import request from '../utils/request'

export const ordersApi = {
  getAll: (params?: object) => request.get('/orders', { params }),
  getById: (id: number) => request.get(`/orders/${id}`),
  updateStatus: (id: number, status: string) =>
    request.put(`/orders/${id}/status`, { status }),
  getReport: (params: object) => request.get('/orders/report', { params }),
}
