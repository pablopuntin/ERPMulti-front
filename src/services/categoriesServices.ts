import api from "./api";

export const categoriesService = {
  async getAll() {
    const res = await api.get("/categories");
    return res.data;
  },

  async create(data: any) {
    const res = await api.post("/categories", data);
    return res.data;
  },

  async update(id: string, data: any) {
    const res = await api.patch(`/categories/${id}`, data);
    return res.data;
  },

  async delete(id: string) {
    const res = await api.delete(`/categories/${id}`);
    return res.data;
  },
};
