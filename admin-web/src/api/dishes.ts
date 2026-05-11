import request from '../utils/request'

export const dishesApi = {
  getList: (params?: object) => request.get('/dishes', { params }),
  getById: (id: number) => request.get(`/dishes/${id}`),
  getCategories: () => request.get('/dishes/categories'),
  create: (data: FormData) =>
    request.post('/dishes', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id: number, data: FormData | object) => {
    const isFormData = data instanceof FormData
    return request.put(`/dishes/${id}`, data, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {},
    })
  },
  delete: (id: number) => request.delete(`/dishes/${id}`),
}
