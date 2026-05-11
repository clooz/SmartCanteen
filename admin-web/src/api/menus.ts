import request from '../utils/request'

export const menusApi = {
  getToday: () => request.get('/menus/today'),
  getByDate: (date: string) => request.get(`/menus/date/${date}`),
  getList: (params?: object) => request.get('/menus', { params }),
  createOrUpdate: (data: object) => request.post('/menus', data),
  updateStatus: (id: number, status: string) =>
    request.put(`/menus/${id}/status`, { status }),
  delete: (id: number) => request.delete(`/menus/${id}`),
}
