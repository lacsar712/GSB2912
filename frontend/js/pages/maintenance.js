/**
 * 设备维护工单页面
 */
const MaintenancePage = {
    init() {
        this.loadWorkOrders();
    },

    destroy() {
    },

    async loadWorkOrders() {
        try {
            const response = await MaintenanceService.getWorkOrders({ size: 100 });
            if (response.code === 200) {
                this.renderWorkOrders(response.data.items || []);
            }
        } catch (error) {
            Toast.error('加载维护工单失败');
        }
    },

    renderWorkOrders(workOrders) {
        const container = document.getElementById('pageContainer');
        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">设备维护工单管理</h3>
                    <button class="btn btn-primary" onclick="MaintenancePage.showAddModal()">新建工单</button>
                </div>
                <div class="card-body">
                    <div class="filter-bar" style="margin-bottom: 16px; display: flex; gap: 12px; flex-wrap: wrap;">
                        <select class="form-control" style="width: 150px;" id="filterStatus" onchange="MaintenancePage.applyFilter()">
                            <option value="">全部状态</option>
                            <option value="pending">待处理</option>
                            <option value="in_progress">处理中</option>
                            <option value="completed">已完成</option>
                            <option value="cancelled">已取消</option>
                        </select>
                        <select class="form-control" style="width: 150px;" id="filterType" onchange="MaintenancePage.applyFilter()">
                            <option value="">全部类型</option>
                            <option value="preventive">预防性维护</option>
                            <option value="corrective">故障维修</option>
                            <option value="inspection">设备检查</option>
                        </select>
                    </div>
                    <div id="workOrderTable"></div>
                </div>
            </div>
        `;

        this.renderTable(workOrders);
    },

    renderTable(data) {
        new DataTable('#workOrderTable', {
            columns: [
                { field: 'work_order_code', title: '工单编号' },
                { field: 'equipment_code', title: '设备编号' },
                { field: 'equipment_name', title: '设备名称' },
                { field: 'title', title: '工单标题' },
                {
                    field: 'work_order_type',
                    title: '工单类型',
                    render: (v) => this.getTypeText(v)
                },
                {
                    field: 'priority',
                    title: '优先级',
                    render: (v) => `<span class="badge ${v >= 8 ? 'badge-danger' : v >= 5 ? 'badge-warning' : 'badge-success'}">${v}</span>`
                },
                {
                    field: 'status',
                    title: '状态',
                    render: (v) => `<span class="status-badge ${this.getStatusClass(v)}">${this.getStatusText(v)}</span>`
                },
                { field: 'assignee', title: '负责人', render: (v) => v || '-' },
                {
                    field: 'create_time',
                    title: '创建时间',
                    render: (v) => v || '-'
                },
                {
                    field: 'id',
                    title: '操作',
                    render: (id, row) => this.renderActionButtons(id, row)
                }
            ],
            data: data
        });
    },

    async applyFilter() {
        const status = document.getElementById('filterStatus').value;
        const type = document.getElementById('filterType').value;
        const params = { size: 100 };
        if (status) params.status = status;
        if (type) params.type = type;

        try {
            const response = await MaintenanceService.getWorkOrders(params);
            if (response.code === 200) {
                this.renderTable(response.data.items || []);
            }
        } catch (error) {
            Toast.error('筛选失败');
        }
    },

    renderActionButtons(id, workOrder) {
        const buttons = [];
        const status = workOrder.status;

        buttons.push(`<button class="btn btn-sm btn-outline" onclick="MaintenancePage.showDetailModal(${id})">详情</button>`);

        if (status === 'pending') {
            buttons.push(`<button class="btn btn-sm btn-success" onclick="MaintenancePage.startWorkOrder(${id})">开始</button>`);
            buttons.push(`<button class="btn btn-sm btn-secondary" onclick="MaintenancePage.cancelWorkOrder(${id})">取消</button>`);
        } else if (status === 'in_progress') {
            buttons.push(`<button class="btn btn-sm btn-success" onclick="MaintenancePage.completeWorkOrder(${id})">完成</button>`);
            buttons.push(`<button class="btn btn-sm btn-secondary" onclick="MaintenancePage.cancelWorkOrder(${id})">取消</button>`);
        }

        if (status === 'pending') {
            buttons.push(`<button class="btn btn-sm btn-outline-danger" onclick="MaintenancePage.deleteWorkOrder(${id})">删除</button>`);
        }

        return buttons.join(' ');
    },

    getStatusText(status) {
        const map = {
            pending: '待处理',
            in_progress: '处理中',
            completed: '已完成',
            cancelled: '已取消'
        };
        return map[status] || status;
    },

    getStatusClass(status) {
        const map = {
            pending: 'stopped',
            in_progress: 'running',
            completed: 'idle',
            cancelled: 'error'
        };
        return map[status] || '';
    },

    getTypeText(type) {
        const map = {
            preventive: '预防性维护',
            corrective: '故障维修',
            inspection: '设备检查'
        };
        return map[type] || type;
    },

    async updateStatus(id, status) {
        try {
            const response = await MaintenanceService.updateWorkOrderStatus(id, status);
            if (response.code === 200) {
                Toast.success('状态更新成功');
                this.loadWorkOrders();
                return true;
            } else {
                Toast.error(response.message || '操作失败');
                return false;
            }
        } catch (error) {
            console.error('更新工单状态失败:', error);
            Toast.error('操作失败，请稍后重试');
            return false;
        }
    },

    async startWorkOrder(id) {
        if (!confirm('确定要开始此维护工单吗？')) return;
        await this.updateStatus(id, 'in_progress');
    },

    async completeWorkOrder(id) {
        const result = prompt('请输入维护结果备注：', '');
        if (result === null) return;

        try {
            await MaintenanceService.updateWorkOrder(id, { result: result || '维护完成' });
        } catch (e) {
            console.warn('更新备注失败:', e);
        }

        await this.updateStatus(id, 'completed');
    },

    async cancelWorkOrder(id) {
        if (!confirm('确定要取消此维护工单吗？')) return;
        await this.updateStatus(id, 'cancelled');
    },

    async deleteWorkOrder(id) {
        if (!confirm('确定要删除此维护工单吗？此操作不可恢复。')) return;

        try {
            const response = await MaintenanceService.deleteWorkOrder(id);
            if (response.code === 200) {
                Toast.success('删除成功');
                this.loadWorkOrders();
            } else {
                Toast.error(response.message || '删除失败');
            }
        } catch (error) {
            Toast.error('删除失败，请稍后重试');
        }
    },

    async showDetailModal(id) {
        try {
            const response = await MaintenanceService.getWorkOrderById(id);
            if (response.code === 200) {
                const wo = response.data;
                new Modal({
                    title: '工单详情',
                    content: `
                        <div style="display: grid; gap: 12px;">
                            <div style="display: flex; gap: 16px;">
                                <div style="flex: 1;">
                                    <div style="color: var(--text-secondary); font-size: 13px;">工单编号</div>
                                    <div style="font-weight: 500;">${wo.work_order_code || '-'}</div>
                                </div>
                                <div style="flex: 1;">
                                    <div style="color: var(--text-secondary); font-size: 13px;">状态</div>
                                    <div><span class="status-badge ${this.getStatusClass(wo.status)}">${this.getStatusText(wo.status)}</span></div>
                                </div>
                            </div>
                            <div style="display: flex; gap: 16px;">
                                <div style="flex: 1;">
                                    <div style="color: var(--text-secondary); font-size: 13px;">设备编号</div>
                                    <div>${wo.equipment_code || '-'}</div>
                                </div>
                                <div style="flex: 1;">
                                    <div style="color: var(--text-secondary); font-size: 13px;">设备名称</div>
                                    <div>${wo.equipment_name || '-'}</div>
                                </div>
                            </div>
                            <div>
                                <div style="color: var(--text-secondary); font-size: 13px;">工单标题</div>
                                <div>${wo.title || '-'}</div>
                            </div>
                            <div style="display: flex; gap: 16px;">
                                <div style="flex: 1;">
                                    <div style="color: var(--text-secondary); font-size: 13px;">工单类型</div>
                                    <div>${this.getTypeText(wo.work_order_type)}</div>
                                </div>
                                <div style="flex: 1;">
                                    <div style="color: var(--text-secondary); font-size: 13px;">优先级</div>
                                    <div>${wo.priority || '-'}</div>
                                </div>
                            </div>
                            <div>
                                <div style="color: var(--text-secondary); font-size: 13px;">负责人</div>
                                <div>${wo.assignee || '-'}</div>
                            </div>
                            <div>
                                <div style="color: var(--text-secondary); font-size: 13px;">问题描述</div>
                                <div style="white-space: pre-wrap;">${wo.description || '-'}</div>
                            </div>
                            <div style="display: flex; gap: 16px;">
                                <div style="flex: 1;">
                                    <div style="color: var(--text-secondary); font-size: 13px;">计划开始</div>
                                    <div>${wo.planned_start_time || '-'}</div>
                                </div>
                                <div style="flex: 1;">
                                    <div style="color: var(--text-secondary); font-size: 13px;">计划结束</div>
                                    <div>${wo.planned_end_time || '-'}</div>
                                </div>
                            </div>
                            <div style="display: flex; gap: 16px;">
                                <div style="flex: 1;">
                                    <div style="color: var(--text-secondary); font-size: 13px;">实际开始</div>
                                    <div>${wo.actual_start_time || '-'}</div>
                                </div>
                                <div style="flex: 1;">
                                    <div style="color: var(--text-secondary); font-size: 13px;">实际结束</div>
                                    <div>${wo.actual_end_time || '-'}</div>
                                </div>
                            </div>
                            <div>
                                <div style="color: var(--text-secondary); font-size: 13px;">维护费用</div>
                                <div>${wo.cost || 0} 元</div>
                            </div>
                            <div>
                                <div style="color: var(--text-secondary); font-size: 13px;">维护结果</div>
                                <div style="white-space: pre-wrap;">${wo.result || '-'}</div>
                            </div>
                            <div style="display: flex; gap: 16px;">
                                <div style="flex: 1;">
                                    <div style="color: var(--text-secondary); font-size: 13px;">创建时间</div>
                                    <div>${wo.create_time || '-'}</div>
                                </div>
                                <div style="flex: 1;">
                                    <div style="color: var(--text-secondary); font-size: 13px;">更新时间</div>
                                    <div>${wo.update_time || '-'}</div>
                                </div>
                            </div>
                        </div>
                    `,
                    hideFooter: true,
                    showCancel: false
                }).show();
            }
        } catch (error) {
            Toast.error('加载详情失败');
        }
    },

    async showAddModal() {
        try {
            const eqResponse = await MaintenanceService.getAvailableEquipments();
            const equipments = eqResponse.code === 200 ? (eqResponse.data || []) : [];

            if (equipments.length === 0) {
                Toast.warning('当前没有空闲或故障状态的设备，无法创建维护工单');
                return;
            }

            const equipmentOptions = equipments.map(e =>
                `<option value="${e.id}">${e.equipment_code} - ${e.equipment_name} (${this.getEquipmentStatusText(e.status)})</option>`
            ).join('');

            new Modal({
                title: '新建设备维护工单',
                content: `
                    <form id="workOrderForm">
                        <div class="form-group">
                            <label class="form-label">工单编号 <span style="color:red;">*</span></label>
                            <input type="text" class="form-control" name="work_order_code" placeholder="例如: WO202401001" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">选择设备 <span style="color:red;">*</span></label>
                            <select class="form-control" name="equipment_id" required>
                                <option value="">请选择设备（仅显示空闲/故障状态）</option>
                                ${equipmentOptions}
                            </select>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                                提示：仅状态为"空闲"或"故障"的设备可创建维护工单
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">工单标题 <span style="color:red;">*</span></label>
                            <input type="text" class="form-control" name="title" placeholder="简要描述维护内容" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">工单类型</label>
                            <select class="form-control" name="work_order_type">
                                <option value="corrective">故障维修</option>
                                <option value="preventive">预防性维护</option>
                                <option value="inspection">设备检查</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">优先级</label>
                            <select class="form-control" name="priority">
                                <option value="3">低</option>
                                <option value="5" selected>普通</option>
                                <option value="7">较高</option>
                                <option value="9">紧急</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">负责人</label>
                            <input type="text" class="form-control" name="assignee" placeholder="维护人员姓名">
                        </div>
                        <div class="form-group">
                            <label class="form-label">故障描述/维护内容</label>
                            <textarea class="form-control" name="description" rows="3" placeholder="请详细描述故障现象或维护内容"></textarea>
                        </div>
                    </form>
                `,
                onConfirm: async () => {
                    const form = document.getElementById('workOrderForm');
                    const data = Object.fromEntries(new FormData(form));
                    data.equipment_id = parseInt(data.equipment_id);
                    data.priority = parseInt(data.priority);

                    if (!data.equipment_id) {
                        Toast.error('请选择设备');
                        return false;
                    }

                    const response = await MaintenanceService.createWorkOrder(data);
                    if (response.code === 201) {
                        Toast.success('创建成功');
                        MaintenancePage.loadWorkOrders();
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

    getEquipmentStatusText(status) {
        const map = {
            running: '运行中',
            idle: '空闲',
            maintenance: '维护中',
            error: '故障',
            offline: '离线'
        };
        return map[status] || status;
    }
};

window.MaintenancePage = MaintenancePage;
