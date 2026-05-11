import request from '../utils/request'

export const wishApi = {
  getActivities: (params?: object) => request.get('/wish/activities', { params }),
  createActivity: (data: object) => request.post('/wish/activities', data),
  closeActivity: (id: number) => request.put(`/wish/activities/${id}/close`, {}),
  getItems: (activityId: number) =>
    request.get(`/wish/activities/${activityId}/items`),
  adoptItem: (itemId: number, data: object) =>
    request.post(`/wish/items/${itemId}/adopt`, data),
}
