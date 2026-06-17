/**
 * 设备维护工单服务
 */
const MaintenanceService = {
    async getOrders(params = {}) {
        return await Request.get('/maintenance/orders', params);
    },

    async getOrderById(id) {
        return await Request.get(`/maintenance/orders/${id}`);
    },

    async createOrder(data) {
        return await Request.post('/maintenance/orders', data);
    },

    async updateOrder(id, data) {
        return await Request.put(`/maintenance/orders/${id}`, data);
    },

    async updateOrderStatus(id, status) {
        return await Request.put(`/maintenance/orders/${id}/status`, { status });
    },

    async deleteOrder(id) {
        return await Request.delete(`/maintenance/orders/${id}`);
    },

    async getStatistics() {
        return await Request.get('/maintenance/statistics');
    }
};

window.MaintenanceService = MaintenanceService;
