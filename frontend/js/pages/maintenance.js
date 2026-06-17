/**
 * 设备维护工单页面
 */
const MaintenancePage = {
    currentPage: 1,
    pageSize: 10,
    filters: {
        status: '',
        orderType: ''
    },

    init() {
        this.loadOrders();
    },

    destroy() {
    },

    async loadOrders() {
        try {
            const params = {
                page: this.currentPage,
                size: this.pageSize,
                ...this.filters
            };
            const response = await MaintenanceService.getOrders(params);
            if (response.code === 200) {
                this.renderPage(response.data);
            }
        } catch (error) {
            Toast.error('加载维护工单失败');
        }
    },

    renderPage(pageData) {
        const container = document.getElementById('pageContainer');
        const { items, total, page, size } = pageData;

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">设备维护工单</h3>
                    <button class="btn btn-primary" onclick="MaintenancePage.showAddModal()">新建工单</button>
                </div>
                <div class="card-body">
                    <div class="filter-bar" style="margin-bottom: 16px; display: flex; gap: 12px; flex-wrap: wrap;">
                        <div>
                            <label style="margin-right: 8px;">状态：</label>
                            <select class="form-control" style="display: inline-block; width: 150px;" onchange="MaintenancePage.onFilterChange('status', this.value)">
                                <option value="">全部</option>
                                <option value="pending">待处理</option>
                                <option value="in_progress">进行中</option>
                                <option value="completed">已完成</option>
                                <option value="cancelled">已取消</option>
                            </select>
                        </div>
                        <div>
                            <label style="margin-right: 8px;">类型：</label>
                            <select class="form-control" style="display: inline-block; width: 150px;" onchange="MaintenancePage.onFilterChange('orderType', this.value)">
                                <option value="">全部</option>
                                <option value="preventive">预防性</option>
                                <option value="corrective">修复性</option>
                                <option value="emergency">紧急</option>
                            </select>
                        </div>
                    </div>
                    <div id="orderTable"></div>
                    <div id="pagination"></div>
                </div>
            </div>
        `;

        this.renderTable(items);
        this.renderPagination(total, page, size);
    },

    renderTable(orders) {
        new DataTable('#orderTable', {
            columns: [
                { field: 'order_code', title: '工单编号' },
                { field: 'order_name', title: '工单名称' },
                { field: 'equipment_name', title: '设备名称', render: (v) => v || '-' },
                { field: 'order_type', title: '维护类型', render: (v) => this.getTypeText(v) },
                { field: 'priority', title: '优先级', render: (v) => `<span class="badge ${v >= 8 ? 'badge-danger' : v >= 5 ? 'badge-warning' : 'badge-success'}">${v}</span>` },
                { field: 'status', title: '状态', render: (v) => `<span class="status-badge ${v}">${this.getStatusText(v)}</span>` },
                { field: 'assignee', title: '负责人', render: (v) => v || '-' },
                { field: 'create_time', title: '创建时间', render: (v) => v || '-' },
                {
                    field: 'id',
                    title: '操作',
                    render: (id, row) => this.renderActionButtons(id, row)
                }
            ],
            data: orders
        });
    },

    renderActionButtons(id, order) {
        const buttons = [];
        const status = order.status;

        buttons.push(`<button class="btn btn-sm btn-outline" onclick="MaintenancePage.showDetail(${id})">详情</button>`);

        if (status === 'pending') {
            buttons.push(`<button class="btn btn-sm btn-success" onclick="MaintenancePage.startOrder(${id})">开始</button>`);
            buttons.push(`<button class="btn btn-sm btn-secondary" onclick="MaintenancePage.cancelOrder(${id})">取消</button>`);
        } else if (status === 'in_progress') {
            buttons.push(`<button class="btn btn-sm btn-success" onclick="MaintenancePage.completeOrder(${id})">完成</button>`);
            buttons.push(`<button class="btn btn-sm btn-secondary" onclick="MaintenancePage.cancelOrder(${id})">取消</button>`);
        }

        if (status === 'pending' || status === 'cancelled') {
            buttons.push(`<button class="btn btn-sm btn-danger" onclick="MaintenancePage.deleteOrder(${id})">删除</button>`);
        }

        return buttons.join(' ');
    },

    renderPagination(total, page, size) {
        new Pagination('#pagination', {
            total,
            page,
            size,
            onChange: (newPage) => {
                this.currentPage = newPage;
                this.loadOrders();
            }
        });
    },

    onFilterChange(key, value) {
        this.filters[key] = value;
        this.currentPage = 1;
        this.loadOrders();
    },

    getStatusText(status) {
        const map = {
            pending: '待处理',
            in_progress: '进行中',
            completed: '已完成',
            cancelled: '已取消'
        };
        return map[status] || status;
    },

    getTypeText(type) {
        const map = {
            preventive: '预防性',
            corrective: '修复性',
            emergency: '紧急'
        };
        return map[type] || type;
    },

    async updateOrderStatus(id, status) {
        try {
            const response = await MaintenanceService.updateOrderStatus(id, status);
            if (response.code === 200) {
                Toast.success('状态更新成功');
                this.loadOrders();
                return true;
            } else {
                Toast.error(response.message || '操作失败');
                return false;
            }
        } catch (error) {
            Toast.error('操作失败，请稍后重试');
            return false;
        }
    },

    async startOrder(id) {
        if (!confirm('确定要开始此维护工单吗？')) return;
        await this.updateOrderStatus(id, 'in_progress');
    },

    async completeOrder(id) {
        if (!confirm('确定要完成此维护工单吗？')) return;
        await this.updateOrderStatus(id, 'completed');
    },

    async cancelOrder(id) {
        if (!confirm('确定要取消此维护工单吗？')) return;
        await this.updateOrderStatus(id, 'cancelled');
    },

    async deleteOrder(id) {
        if (!confirm('确定要删除此维护工单吗？此操作不可恢复。')) return;
        try {
            const response = await MaintenanceService.deleteOrder(id);
            if (response.code === 200) {
                Toast.success('删除成功');
                this.loadOrders();
            } else {
                Toast.error(response.message || '删除失败');
            }
        } catch (error) {
            Toast.error('删除失败，请稍后重试');
        }
    },

    async showAddModal() {
        try {
            const equipResponse = await ProductionService.getEquipments({ size: 100 });
            let equipments = [];
            if (equipResponse.code === 200) {
                equipments = equipResponse.data.items.filter(e => e.status === 'idle' || e.status === 'error');
            }

            if (equipments.length === 0) {
                Toast.warning('当前没有空闲或故障状态的设备，无法创建维护工单');
                return;
            }

            const equipOptions = equipments.map(e =>
                `<option value="${e.id}">${e.equipment_name} (${e.equipment_code}) [${e.status}]</option>`
            ).join('');

            new Modal({
                title: '新建维护工单',
                content: `
                    <form id="orderForm">
                        <div class="form-group">
                            <label class="form-label">工单编号 <span style="color:red;">*</span></label>
                            <input type="text" class="form-control" name="order_code" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">工单名称 <span style="color:red;">*</span></label>
                            <input type="text" class="form-control" name="order_name" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">选择设备 <span style="color:red;">*</span></label>
                            <select class="form-control" name="equipment_id" required>
                                <option value="">请选择设备（仅显示空闲/故障状态）</option>
                                ${equipOptions}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">维护类型</label>
                            <select class="form-control" name="order_type">
                                <option value="preventive">预防性维护</option>
                                <option value="corrective">修复性维护</option>
                                <option value="emergency">紧急维护</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">优先级</label>
                            <select class="form-control" name="priority">
                                <option value="3">低</option>
                                <option value="5" selected>中</option>
                                <option value="7">高</option>
                                <option value="9">紧急</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">负责人</label>
                            <input type="text" class="form-control" name="assignee">
                        </div>
                        <div class="form-group">
                            <label class="form-label">故障描述/维护内容</label>
                            <textarea class="form-control" name="description" rows="3"></textarea>
                        </div>
                    </form>
                `,
                width: '600px',
                onConfirm: async () => {
                    const form = document.getElementById('orderForm');
                    const data = Object.fromEntries(new FormData(form));
                    data.equipment_id = parseInt(data.equipment_id);
                    data.priority = parseInt(data.priority);

                    if (!data.equipment_id) {
                        Toast.error('请选择设备');
                        return false;
                    }

                    const response = await MaintenanceService.createOrder(data);
                    if (response.code === 201) {
                        Toast.success('创建成功');
                        this.loadOrders();
                        return true;
                    } else {
                        Toast.error(response.message);
                        return false;
                    }
                }
            }).show();
        } catch (error) {
            Toast.error('加载设备列表失败');
        }
    },

    async showDetail(id) {
        try {
            const response = await MaintenanceService.getOrderById(id);
            if (response.code === 200) {
                const order = response.data;
                new Modal({
                    title: '工单详情',
                    content: `
                        <div style="line-height: 1.8;">
                            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 8px; margin-bottom: 12px;">
                                <span style="color: #666;">工单编号：</span>
                                <span>${order.order_code}</span>
                                <span style="color: #666;">工单名称：</span>
                                <span>${order.order_name}</span>
                                <span style="color: #666;">设备名称：</span>
                                <span>${order.equipment_name || '-'}</span>
                                <span style="color: #666;">设备编号：</span>
                                <span>${order.equipment_code || '-'}</span>
                                <span style="color: #666;">维护类型：</span>
                                <span>${this.getTypeText(order.order_type)}</span>
                                <span style="color: #666;">优先级：</span>
                                <span>${order.priority}</span>
                                <span style="color: #666;">状态：</span>
                                <span><span class="status-badge ${order.status}">${this.getStatusText(order.status)}</span></span>
                                <span style="color: #666;">负责人：</span>
                                <span>${order.assignee || '-'}</span>
                                <span style="color: #666;">创建时间：</span>
                                <span>${order.create_time || '-'}</span>
                                <span style="color: #666;">实际开始：</span>
                                <span>${order.actual_start_time || '-'}</span>
                                <span style="color: #666;">实际结束：</span>
                                <span>${order.actual_end_time || '-'}</span>
                                <span style="color: #666;">维护费用：</span>
                                <span>¥${order.cost || 0}</span>
                            </div>
                            <div style="margin-top: 12px;">
                                <div style="color: #666; margin-bottom: 4px;">描述：</div>
                                <div style="background: #f5f5f5; padding: 12px; border-radius: 4px;">${order.description || '无'}</div>
                            </div>
                            ${order.resolve_note ? `
                            <div style="margin-top: 12px;">
                                <div style="color: #666; margin-bottom: 4px;">解决备注：</div>
                                <div style="background: #f5f5f5; padding: 12px; border-radius: 4px;">${order.resolve_note}</div>
                            </div>
                            ` : ''}
                        </div>
                    `,
                    width: '600px',
                    showFooter: true,
                    confirmText: '关闭'
                }).show();
            }
        } catch (error) {
            Toast.error('加载详情失败');
        }
    }
};

window.MaintenancePage = MaintenancePage;
