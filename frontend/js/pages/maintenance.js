/**
 * 设备维护工单管理页面
 */
const MaintenancePage = {
    currentPage: 1,
    pageSize: 10,
    filters: {
        status: '',
        priority: '',
        maintenanceType: ''
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

    renderPage(paginationData) {
        const container = document.getElementById('pageContainer');
        const items = paginationData.items || [];

        container.innerHTML = `
            <div class="stat-cards">
                <div class="stat-card">
                    <div class="stat-card-title">总工单</div>
                    <div class="stat-card-value" id="statTotal">${paginationData.total || 0}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-title">待处理</div>
                    <div class="stat-card-value" style="color: #ffc107;" id="statPending">0</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-title">处理中</div>
                    <div class="stat-card-value" style="color: #17a2b8;" id="statInProgress">0</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-title">已完成</div>
                    <div class="stat-card-value" style="color: #28a745;" id="statCompleted">0</div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">设备维护工单管理</h3>
                    <button class="btn btn-primary" onclick="MaintenancePage.showAddModal()">新建工单</button>
                </div>
                <div class="card-body">
                    <div class="toolbar" style="margin-bottom: 16px;">
                        <div class="toolbar-left">
                            <select class="form-control" style="width: 150px;" id="filterStatus" onchange="MaintenancePage.onFilterChange('status', this.value)">
                                <option value="">全部状态</option>
                                <option value="pending">待处理</option>
                                <option value="in_progress">处理中</option>
                                <option value="completed">已完成</option>
                                <option value="cancelled">已取消</option>
                            </select>
                            <select class="form-control" style="width: 150px;" id="filterPriority" onchange="MaintenancePage.onFilterChange('priority', this.value)">
                                <option value="">全部优先级</option>
                                <option value="low">低</option>
                                <option value="medium">中</option>
                                <option value="high">高</option>
                                <option value="critical">紧急</option>
                            </select>
                            <select class="form-control" style="width: 150px;" id="filterType" onchange="MaintenancePage.onFilterChange('maintenanceType', this.value)">
                                <option value="">全部类型</option>
                                <option value="routine">常规维护</option>
                                <option value="fault">故障维修</option>
                                <option value="preventive">预防性维护</option>
                                <option value="emergency">紧急维修</option>
                            </select>
                        </div>
                    </div>
                    <div id="orderTable"></div>
                    <div id="paginationContainer" style="margin-top: 16px;"></div>
                </div>
            </div>
        `;

        this.renderTable(items);
        this.renderPagination(paginationData);
        this.loadStatistics();
    },

    async loadStatistics() {
        try {
            const response = await MaintenanceService.getStatistics();
            if (response.code === 200) {
                const data = response.data;
                const pendingEl = document.getElementById('statPending');
                const inProgressEl = document.getElementById('statInProgress');
                const completedEl = document.getElementById('statCompleted');
                if (pendingEl) pendingEl.textContent = data.pending || 0;
                if (inProgressEl) inProgressEl.textContent = data.in_progress || 0;
                if (completedEl) completedEl.textContent = data.completed || 0;
            }
        } catch (e) {
        }
    },

    renderTable(items) {
        new DataTable('#orderTable', {
            columns: [
                { field: 'order_code', title: '工单编号' },
                { field: 'order_title', title: '工单标题' },
                { field: 'equipment_name', title: '设备名称', render: (v, row) => v || row.equipment_code || '-' },
                { field: 'maintenance_type', title: '维护类型', render: (v) => this.getTypeText(v) },
                { field: 'priority', title: '优先级', render: (v) => this.getPriorityBadge(v) },
                { field: 'status', title: '状态', render: (v) => this.getStatusBadge(v) },
                { field: 'assignee', title: '负责人', render: (v) => v || '-' },
                { field: 'create_time', title: '创建时间', render: (v) => v ? v.substring(0, 16) : '-' },
                {
                    field: 'id',
                    title: '操作',
                    render: (id, row) => this.renderActionButtons(id, row)
                }
            ],
            data: items
        });
    },

    renderPagination(paginationData) {
        const container = document.getElementById('paginationContainer');
        if (!container) return;

        const { total, page, size } = paginationData;
        const pages = Math.ceil(total / size) || 1;

        let html = '<div style="display: flex; justify-content: space-between; align-items: center;">';
        html += `<div style="color: #6c757d; font-size: 14px;">共 ${total} 条，第 ${page}/${pages} 页</div>`;
        html += '<div style="display: flex; gap: 8px;">';
        html += `<button class="btn btn-sm btn-outline" onclick="MaintenancePage.goToPage(${page - 1})" ${page <= 1 ? 'disabled' : ''}>上一页</button>`;
        html += `<button class="btn btn-sm btn-outline" onclick="MaintenancePage.goToPage(${page + 1})" ${page >= pages ? 'disabled' : ''}>下一页</button>`;
        html += '</div></div>';

        container.innerHTML = html;
    },

    goToPage(page) {
        if (page < 1) return;
        this.currentPage = page;
        this.loadOrders();
    },

    onFilterChange(key, value) {
        this.filters[key] = value;
        this.currentPage = 1;
        this.loadOrders();
    },

    renderActionButtons(id, row) {
        const buttons = [];
        const status = row.status;

        buttons.push(`<button class="btn btn-sm btn-outline" onclick="MaintenancePage.viewOrder(${id})">查看</button>`);

        if (status === 'pending') {
            buttons.push(`<button class="btn btn-sm btn-primary" onclick="MaintenancePage.startOrder(${id})">开始处理</button>`);
            buttons.push(`<button class="btn btn-sm btn-secondary" onclick="MaintenancePage.cancelOrder(${id})">取消</button>`);
        } else if (status === 'in_progress') {
            buttons.push(`<button class="btn btn-sm btn-success" onclick="MaintenancePage.completeOrder(${id})">完成</button>`);
            buttons.push(`<button class="btn btn-sm btn-secondary" onclick="MaintenancePage.cancelOrder(${id})">取消</button>`);
        }

        if (status === 'pending') {
            buttons.push(`<button class="btn btn-sm btn-outline" onclick="MaintenancePage.showEditModal(${id})">编辑</button>`);
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

    getStatusBadge(status) {
        const map = {
            pending: 'warning',
            in_progress: 'primary',
            completed: 'success',
            cancelled: 'secondary'
        };
        const text = this.getStatusText(status);
        const cls = map[status] || 'secondary';
        return `<span class="badge badge-${cls}">${text}</span>`;
    },

    getPriorityText(priority) {
        const map = { low: '低', medium: '中', high: '高', critical: '紧急' };
        return map[priority] || priority;
    },

    getPriorityBadge(priority) {
        const map = {
            low: 'success',
            medium: 'info',
            high: 'warning',
            critical: 'danger'
        };
        const text = this.getPriorityText(priority);
        const cls = map[priority] || 'secondary';
        return `<span class="badge badge-${cls}">${text}</span>`;
    },

    getTypeText(type) {
        const map = {
            routine: '常规维护',
            fault: '故障维修',
            preventive: '预防性维护',
            emergency: '紧急维修'
        };
        return map[type] || type;
    },

    async viewOrder(id) {
        try {
            const response = await MaintenanceService.getOrderById(id);
            if (response.code === 200) {
                const order = response.data;
                new Modal({
                    title: '工单详情',
                    content: `
                        <div style="line-height: 2;">
                            <div><strong>工单编号：</strong>${order.order_code}</div>
                            <div><strong>工单标题：</strong>${order.order_title}</div>
                            <div><strong>设备名称：</strong>${order.equipment_name || order.equipment_code || '-'}</div>
                            <div><strong>维护类型：</strong>${this.getTypeText(order.maintenance_type)}</div>
                            <div><strong>优先级：</strong>${this.getPriorityBadge(order.priority)}</div>
                            <div><strong>状态：</strong>${this.getStatusBadge(order.status)}</div>
                            <div><strong>负责人：</strong>${order.assignee || '-'}</div>
                            <div><strong>计划开始：</strong>${order.plan_start_time ? order.plan_start_time.substring(0, 16) : '-'}</div>
                            <div><strong>计划结束：</strong>${order.plan_end_time ? order.plan_end_time.substring(0, 16) : '-'}</div>
                            <div><strong>实际开始：</strong>${order.actual_start_time ? order.actual_start_time.substring(0, 16) : '-'}</div>
                            <div><strong>实际结束：</strong>${order.actual_end_time ? order.actual_end_time.substring(0, 16) : '-'}</div>
                            <div><strong>维护费用：</strong>${order.cost || 0} 元</div>
                            <div><strong>创建时间：</strong>${order.create_time ? order.create_time.substring(0, 16) : '-'}</div>
                            <div style="margin-top: 8px;"><strong>描述：</strong></div>
                            <div style="background: var(--bg-light); padding: 12px; border-radius: 4px;">${order.description || '无'}</div>
                            ${order.result_note ? `
                                <div style="margin-top: 8px;"><strong>维护结果：</strong></div>
                                <div style="background: var(--bg-light); padding: 12px; border-radius: 4px;">${order.result_note}</div>
                            ` : ''}
                        </div>
                    `,
                    showFooter: false
                }).show();
            }
        } catch (error) {
            Toast.error('加载工单详情失败');
        }
    },

    async startOrder(id) {
        if (!await Modal.confirm('确定要开始处理此工单吗？')) return;
        try {
            const response = await MaintenanceService.updateOrderStatus(id, 'in_progress');
            if (response.code === 200) {
                Toast.success('工单已开始处理');
                this.loadOrders();
            } else {
                Toast.error(response.message || '操作失败');
            }
        } catch (error) {
            Toast.error('操作失败，请稍后重试');
        }
    },

    async completeOrder(id) {
        const result = await this._showResultModal();
        if (!result) return;

        try {
            const updateData = { result_note: result.note };
            if (result.cost !== null && result.cost !== undefined) {
                updateData.cost = parseFloat(result.cost) || 0;
            }

            const response = await MaintenanceService.updateOrder(id, updateData);
            if (response.code !== 200) {
                Toast.error(response.message || '更新失败');
                return;
            }

            const statusResponse = await MaintenanceService.updateOrderStatus(id, 'completed');
            if (statusResponse.code === 200) {
                Toast.success('工单已完成');
                this.loadOrders();
            } else {
                Toast.error(statusResponse.message || '操作失败');
            }
        } catch (error) {
            Toast.error('操作失败，请稍后重试');
        }
    },

    _showResultModal() {
        return new Promise((resolve) => {
            new Modal({
                title: '完成工单',
                content: `
                    <form id="resultForm">
                        <div class="form-group">
                            <label class="form-label">维护结果备注</label>
                            <textarea class="form-control" name="result_note" rows="4" placeholder="请输入维护结果说明..."></textarea>
                        </div>
                        <div class="form-group">
                            <label class="form-label">维护费用(元)</label>
                            <input type="number" class="form-control" name="cost" placeholder="0" min="0" step="0.01">
                        </div>
                    </form>
                `,
                onConfirm: () => {
                    const form = document.getElementById('resultForm');
                    const data = Object.fromEntries(new FormData(form));
                    if (!data.result_note || !data.result_note.trim()) {
                        Toast.warning('请填写维护结果备注');
                        return false;
                    }
                    resolve({ note: data.result_note, cost: data.cost });
                    return true;
                },
                onCancel: () => {
                    resolve(null);
                }
            }).show();
        });
    },

    async cancelOrder(id) {
        if (!await Modal.confirm('确定要取消此工单吗？')) return;
        try {
            const response = await MaintenanceService.updateOrderStatus(id, 'cancelled');
            if (response.code === 200) {
                Toast.success('工单已取消');
                this.loadOrders();
            } else {
                Toast.error(response.message || '操作失败');
            }
        } catch (error) {
            Toast.error('操作失败，请稍后重试');
        }
    },

    async showAddModal() {
        try {
            const equipResponse = await ProductionService.getEquipments({ size: 200 });
            let equipments = [];
            if (equipResponse.code === 200) {
                equipments = equipResponse.data.items || [];
            }

            const availableEquipments = equipments.filter(e => e.status === 'idle' || e.status === 'error');

            new Modal({
                title: '新建维护工单',
                content: `
                    <form id="orderForm">
                        <div class="form-group">
                            <label class="form-label">工单编号 <span style="color:red;">*</span></label>
                            <input type="text" class="form-control" name="order_code" required placeholder="例如：WO20240101001">
                        </div>
                        <div class="form-group">
                            <label class="form-label">工单标题 <span style="color:red;">*</span></label>
                            <input type="text" class="form-control" name="order_title" required placeholder="请输入工单标题">
                        </div>
                        <div class="form-group">
                            <label class="form-label">选择设备 <span style="color:red;">*</span></label>
                            <select class="form-control" name="equipment_id" required>
                                <option value="">请选择设备（仅空闲或故障状态）</option>
                                ${availableEquipments.map(e => `
                                    <option value="${e.id}">${e.equipment_name} (${e.equipment_code}) - ${e.status === 'idle' ? '空闲' : '故障'}</option>
                                `).join('')}
                            </select>
                            ${availableEquipments.length === 0 ? '<div class="text-warning" style="font-size: 12px; margin-top: 4px;">当前没有空闲或故障状态的设备</div>' : ''}
                        </div>
                        <div class="form-group">
                            <label class="form-label">维护类型</label>
                            <select class="form-control" name="maintenance_type">
                                <option value="routine">常规维护</option>
                                <option value="fault">故障维修</option>
                                <option value="preventive">预防性维护</option>
                                <option value="emergency">紧急维修</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">优先级</label>
                            <select class="form-control" name="priority">
                                <option value="low">低</option>
                                <option value="medium" selected>中</option>
                                <option value="high">高</option>
                                <option value="critical">紧急</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">负责人</label>
                            <input type="text" class="form-control" name="assignee" placeholder="请输入负责人姓名">
                        </div>
                        <div class="form-group">
                            <label class="form-label">计划开始时间</label>
                            <input type="datetime-local" class="form-control" name="plan_start_time">
                        </div>
                        <div class="form-group">
                            <label class="form-label">计划结束时间</label>
                            <input type="datetime-local" class="form-control" name="plan_end_time">
                        </div>
                        <div class="form-group">
                            <label class="form-label">故障描述/维护内容</label>
                            <textarea class="form-control" name="description" rows="4" placeholder="请描述故障情况或维护内容..."></textarea>
                        </div>
                    </form>
                `,
                onConfirm: async () => {
                    const form = document.getElementById('orderForm');
                    const data = Object.fromEntries(new FormData(form));

                    if (!data.equipment_id) {
                        Toast.error('请选择设备');
                        return false;
                    }

                    data.equipment_id = parseInt(data.equipment_id);

                    if (data.plan_start_time) {
                        data.plan_start_time = data.plan_start_time.replace('T', ' ') + ':00';
                    }
                    if (data.plan_end_time) {
                        data.plan_end_time = data.plan_end_time.replace('T', ' ') + ':00';
                    }

                    const response = await MaintenanceService.createOrder(data);
                    if (response.code === 201) {
                        Toast.success('创建成功');
                        this.loadOrders();
                        return true;
                    } else {
                        Toast.error(response.message || '创建失败');
                        return false;
                    }
                }
            }).show();
        } catch (error) {
            Toast.error('加载设备列表失败');
        }
    },

    async showEditModal(id) {
        try {
            const response = await MaintenanceService.getOrderById(id);
            if (response.code !== 200) {
                Toast.error('加载工单信息失败');
                return;
            }
            const order = response.data;

            new Modal({
                title: '编辑维护工单',
                content: `
                    <form id="editForm">
                        <div class="form-group">
                            <label class="form-label">工单标题</label>
                            <input type="text" class="form-control" name="order_title" value="${order.order_title || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">维护类型</label>
                            <select class="form-control" name="maintenance_type">
                                <option value="routine" ${order.maintenance_type === 'routine' ? 'selected' : ''}>常规维护</option>
                                <option value="fault" ${order.maintenance_type === 'fault' ? 'selected' : ''}>故障维修</option>
                                <option value="preventive" ${order.maintenance_type === 'preventive' ? 'selected' : ''}>预防性维护</option>
                                <option value="emergency" ${order.maintenance_type === 'emergency' ? 'selected' : ''}>紧急维修</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">优先级</label>
                            <select class="form-control" name="priority">
                                <option value="low" ${order.priority === 'low' ? 'selected' : ''}>低</option>
                                <option value="medium" ${order.priority === 'medium' ? 'selected' : ''}>中</option>
                                <option value="high" ${order.priority === 'high' ? 'selected' : ''}>高</option>
                                <option value="critical" ${order.priority === 'critical' ? 'selected' : ''}>紧急</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">负责人</label>
                            <input type="text" class="form-control" name="assignee" value="${order.assignee || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">计划开始时间</label>
                            <input type="datetime-local" class="form-control" name="plan_start_time" value="${order.plan_start_time ? order.plan_start_time.replace(' ', 'T').substring(0, 16) : ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">计划结束时间</label>
                            <input type="datetime-local" class="form-control" name="plan_end_time" value="${order.plan_end_time ? order.plan_end_time.replace(' ', 'T').substring(0, 16) : ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">维护费用(元)</label>
                            <input type="number" class="form-control" name="cost" value="${order.cost || 0}" min="0" step="0.01">
                        </div>
                        <div class="form-group">
                            <label class="form-label">故障描述/维护内容</label>
                            <textarea class="form-control" name="description" rows="4">${order.description || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label class="form-label">维护结果备注</label>
                            <textarea class="form-control" name="result_note" rows="3">${order.result_note || ''}</textarea>
                        </div>
                    </form>
                `,
                onConfirm: async () => {
                    const form = document.getElementById('editForm');
                    const data = Object.fromEntries(new FormData(form));

                    if (data.plan_start_time) {
                        data.plan_start_time = data.plan_start_time.replace('T', ' ') + ':00';
                    }
                    if (data.plan_end_time) {
                        data.plan_end_time = data.plan_end_time.replace('T', ' ') + ':00';
                    }
                    if (data.cost) {
                        data.cost = parseFloat(data.cost) || 0;
                    }

                    const response = await MaintenanceService.updateOrder(id, data);
                    if (response.code === 200) {
                        Toast.success('更新成功');
                        this.loadOrders();
                        return true;
                    } else {
                        Toast.error(response.message || '更新失败');
                        return false;
                    }
                }
            }).show();
        } catch (error) {
            Toast.error('加载工单信息失败');
        }
    }
};

window.MaintenancePage = MaintenancePage;
