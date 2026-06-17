/**
 * 设备维护工单管理页面
 */
const MaintenancePage = {
    currentData: [],
    availableEquipments: [],

    init() {
        this.render();
        this.bindEvents();
        this.loadStatistics();
        this.loadOrders();
    },

    destroy() {},

    render() {
        const container = document.getElementById('pageContainer');
        container.innerHTML = `
            <div class="card" style="margin-bottom: 20px;">
                <div class="card-header">
                    <h3 class="card-title">工单统计</h3>
                </div>
                <div class="card-body">
                    <div id="statsContainer" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px;">
                        <div class="loading-container" style="text-align: center; padding: 20px;">
                            <div class="loading-spinner"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">设备维护工单</h3>
                </div>
                <div class="card-body">
                    <div class="toolbar">
                        <div class="toolbar-left">
                            <select class="form-control" id="statusFilter" style="width: 120px;">
                                <option value="">全部状态</option>
                                <option value="pending">待处理</option>
                                <option value="in_progress">处理中</option>
                                <option value="completed">已完成</option>
                                <option value="cancelled">已取消</option>
                            </select>
                            <select class="form-control" id="priorityFilter" style="width: 120px; margin-left: 8px;">
                                <option value="">全部优先级</option>
                                <option value="low">低</option>
                                <option value="medium">中</option>
                                <option value="high">高</option>
                                <option value="critical">紧急</option>
                            </select>
                            <select class="form-control" id="typeFilter" style="width: 120px; margin-left: 8px;">
                                <option value="">全部类型</option>
                                <option value="preventive">预防性</option>
                                <option value="corrective">纠正性</option>
                                <option value="emergency">紧急</option>
                            </select>
                        </div>
                        <div class="toolbar-right">
                            <button class="btn btn-primary" id="addOrderBtn">
                                <span>+ 新建工单</span>
                            </button>
                            <button class="btn btn-outline" id="refreshBtn" style="margin-left: 8px;">
                                <span>刷新</span>
                            </button>
                        </div>
                    </div>
                    <div id="orderTable">
                        <div class="loading-container" style="text-align: center; padding: 40px;">
                            <div class="loading-spinner"></div>
                            <div style="margin-top: 10px; color: var(--text-secondary);">加载中...</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    bindEvents() {
        document.getElementById('statusFilter')?.addEventListener('change', () => this.filterData());
        document.getElementById('priorityFilter')?.addEventListener('change', () => this.filterData());
        document.getElementById('typeFilter')?.addEventListener('change', () => this.filterData());
        document.getElementById('refreshBtn')?.addEventListener('click', () => this.loadOrders());
        document.getElementById('addOrderBtn')?.addEventListener('click', () => this.showAddModal());
    },

    async loadStatistics() {
        try {
            const response = await MaintenanceService.getStatistics();
            if (response.code === 200) {
                this.renderStatistics(response.data);
            }
        } catch (error) {
            console.error('加载统计失败:', error);
        }
    },

    renderStatistics(stats) {
        const container = document.getElementById('statsContainer');
        if (!container) return;

        const items = [
            { label: '总工单', value: stats.total, color: '#667eea' },
            { label: '待处理', value: stats.pending, color: '#ffc107' },
            { label: '处理中', value: stats.in_progress, color: '#17a2b8' },
            { label: '已完成', value: stats.completed, color: '#28a745' },
            { label: '已取消', value: stats.cancelled, color: '#6c757d' },
            { label: '紧急活跃', value: stats.critical_active, color: '#dc3545' }
        ];

        container.innerHTML = items.map(item => `
            <div style="background: linear-gradient(135deg, ${item.color}22, ${item.color}11); border: 1px solid ${item.color}33; border-radius: 8px; padding: 16px; text-align: center;">
                <div style="font-size: 28px; font-weight: bold; color: ${item.color};">${item.value}</div>
                <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">${item.label}</div>
            </div>
        `).join('');
    },

    async loadOrders() {
        const tableContainer = document.getElementById('orderTable');

        try {
            const response = await MaintenanceService.getOrders({ size: 100 });
            if (response.code === 200) {
                this.currentData = response.data.items || [];
                this.renderTable(this.currentData);
            } else {
                tableContainer.innerHTML = `
                    <div class="error-state" style="text-align: center; padding: 40px; color: var(--danger-color);">
                        <div style="font-size: 48px;">⚠️</div>
                        <div>${response.message || '加载失败'}</div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('加载工单失败:', error);
            tableContainer.innerHTML = `
                <div class="error-state" style="text-align: center; padding: 40px; color: var(--danger-color);">
                    <div style="font-size: 48px;">❌</div>
                    <div>加载工单失败: ${error.message}</div>
                    <button class="btn btn-primary" onclick="MaintenancePage.loadOrders()" style="margin-top: 16px;">重试</button>
                </div>
            `;
        }
    },

    renderTable(orders) {
        const container = document.getElementById('orderTable');

        if (!orders || orders.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 60px; color: var(--text-secondary);">
                    <div style="font-size: 64px; margin-bottom: 16px;">🔧</div>
                    <div style="font-size: 18px; margin-bottom: 8px;">暂无维护工单</div>
                    <div style="font-size: 14px;">点击"新建工单"创建第一个维护工单</div>
                </div>
            `;
            return;
        }

        const rows = orders.map(order => this.renderRow(order)).join('');

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>工单编号</th>
                        <th>设备编号</th>
                        <th>设备名称</th>
                        <th>类型</th>
                        <th>优先级</th>
                        <th>负责人</th>
                        <th>状态</th>
                        <th>创建时间</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="table-footer" style="margin-top: 16px; color: var(--text-secondary); font-size: 14px;">
                共 ${orders.length} 条记录
            </div>
        `;
    },

    renderRow(order) {
        return `
            <tr>
                <td>${order.order_code || '-'}</td>
                <td>${order.equipment_code || '-'}</td>
                <td>${order.equipment_name || '-'}</td>
                <td>${this.getOrderTypeText(order.order_type)}</td>
                <td><span class="status-badge ${this.getPriorityClass(order.priority)}">${this.getPriorityText(order.priority)}</span></td>
                <td>${order.assignee || '-'}</td>
                <td><span class="status-badge ${order.status}">${this.getStatusText(order.status)}</span></td>
                <td>${order.create_time || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="MaintenancePage.showDetail(${order.id})">详情</button>
                    ${this.renderActionButtons(order)}
                </td>
            </tr>
        `;
    },

    renderActionButtons(order) {
        const buttons = [];
        const status = order.status;

        if (status === 'pending') {
            buttons.push(`<button class="btn btn-sm btn-success" onclick="MaintenancePage.startOrder(${order.id})">开始处理</button>`);
            buttons.push(`<button class="btn btn-sm btn-secondary" onclick="MaintenancePage.cancelOrder(${order.id})">取消</button>`);
        } else if (status === 'in_progress') {
            buttons.push(`<button class="btn btn-sm btn-success" onclick="MaintenancePage.completeOrder(${order.id})">完成</button>`);
            buttons.push(`<button class="btn btn-sm btn-secondary" onclick="MaintenancePage.cancelOrder(${order.id})">取消</button>`);
        } else if (status === 'completed') {
            buttons.push(`<span class="text-muted">已完成</span>`);
        } else if (status === 'cancelled') {
            buttons.push(`<span class="text-muted">已取消</span>`);
        }

        return ' ' + buttons.join(' ');
    },

    filterData() {
        const status = document.getElementById('statusFilter')?.value;
        const priority = document.getElementById('priorityFilter')?.value;
        const orderType = document.getElementById('typeFilter')?.value;

        let filtered = this.currentData;

        if (status) {
            filtered = filtered.filter(o => o.status === status);
        }
        if (priority) {
            filtered = filtered.filter(o => o.priority === priority);
        }
        if (orderType) {
            filtered = filtered.filter(o => o.order_type === orderType);
        }

        this.renderTable(filtered);
    },

    async showAddModal() {
        try {
            const eqResponse = await MaintenanceService.getAvailableEquipments();
            if (eqResponse.code === 200) {
                this.availableEquipments = eqResponse.data || [];
            } else {
                this.availableEquipments = [];
            }
        } catch (error) {
            console.error('获取可用设备失败:', error);
            this.availableEquipments = [];
        }

        const equipmentOptions = this.availableEquipments.length > 0
            ? this.availableEquipments.map(eq =>
                `<option value="${eq.id}">${eq.equipment_code} - ${eq.equipment_name} (${this.getEquipmentStatusText(eq.status)})</option>`
            ).join('')
            : '<option value="">暂无空闲/故障设备</option>';

        const result = await Modal.form('新建维护工单', `
            <div class="form-group">
                <label>工单编号 <span style="color: red;">*</span></label>
                <input type="text" class="form-control" name="order_code" required placeholder="如: WO-20260617-001">
            </div>
            <div class="form-group">
                <label>维护设备 <span style="color: red;">*</span></label>
                <select class="form-control" name="equipment_id" required>
                    <option value="">请选择设备（仅空闲/故障设备）</option>
                    ${equipmentOptions}
                </select>
            </div>
            <div class="form-group">
                <label>工单类型</label>
                <select class="form-control" name="order_type">
                    <option value="corrective">纠正性维护</option>
                    <option value="preventive">预防性维护</option>
                    <option value="emergency">紧急维护</option>
                </select>
            </div>
            <div class="form-group">
                <label>优先级</label>
                <select class="form-control" name="priority">
                    <option value="low">低</option>
                    <option value="medium" selected>中</option>
                    <option value="high">高</option>
                    <option value="critical">紧急</option>
                </select>
            </div>
            <div class="form-group">
                <label>负责人</label>
                <input type="text" class="form-control" name="assignee" placeholder="维护负责人">
            </div>
            <div class="form-group">
                <label>问题描述</label>
                <textarea class="form-control" name="description" rows="3" placeholder="请描述设备维护需求..."></textarea>
            </div>
            <div class="form-group">
                <label>计划开始时间</label>
                <input type="datetime-local" class="form-control" name="planned_start_time">
            </div>
            <div class="form-group">
                <label>计划结束时间</label>
                <input type="datetime-local" class="form-control" name="planned_end_time">
            </div>
        `);

        if (result) {
            await this.createOrder(result);
        }
    },

    async createOrder(data) {
        try {
            const response = await MaintenanceService.createOrder(data);
            if (response.code === 200 || response.code === 201) {
                Toast.success('维护工单创建成功');
                this.loadOrders();
                this.loadStatistics();
            } else {
                Toast.error(response.message || '创建失败');
            }
        } catch (error) {
            console.error('创建工单失败:', error);
            Toast.error('创建工单失败');
        }
    },

    async showDetail(id) {
        try {
            const response = await MaintenanceService.getOrderById(id);
            if (response.code === 200) {
                const order = response.data;

                await Modal.alert(`
                    <div class="detail-section">
                        <h4>工单信息</h4>
                        <table class="detail-table">
                            <tr><td>工单编号</td><td>${order.order_code}</td></tr>
                            <tr><td>设备编号</td><td>${order.equipment_code || '-'}</td></tr>
                            <tr><td>设备名称</td><td>${order.equipment_name || '-'}</td></tr>
                            <tr><td>工单类型</td><td>${this.getOrderTypeText(order.order_type)}</td></tr>
                            <tr><td>优先级</td><td>${this.getPriorityText(order.priority)}</td></tr>
                            <tr><td>状态</td><td><span class="status-badge ${order.status}">${this.getStatusText(order.status)}</span></td></tr>
                            <tr><td>负责人</td><td>${order.assignee || '-'}</td></tr>
                        </table>
                    </div>
                    <div class="detail-section" style="margin-top: 20px;">
                        <h4>时间信息</h4>
                        <table class="detail-table">
                            <tr><td>创建时间</td><td>${order.create_time || '-'}</td></tr>
                            <tr><td>计划开始</td><td>${order.planned_start_time || '-'}</td></tr>
                            <tr><td>计划结束</td><td>${order.planned_end_time || '-'}</td></tr>
                            <tr><td>实际开始</td><td>${order.actual_start_time || '-'}</td></tr>
                            <tr><td>实际结束</td><td>${order.actual_end_time || '-'}</td></tr>
                        </table>
                    </div>
                    ${order.description ? `
                    <div class="detail-section" style="margin-top: 20px;">
                        <h4>问题描述</h4>
                        <div style="padding: 12px; background: var(--bg-light); border-radius: 6px;">${order.description}</div>
                    </div>` : ''}
                    ${order.completion_note ? `
                    <div class="detail-section" style="margin-top: 20px;">
                        <h4>完成备注</h4>
                        <div style="padding: 12px; background: var(--bg-light); border-radius: 6px;">${order.completion_note}</div>
                    </div>` : ''}
                    ${order.cancel_reason ? `
                    <div class="detail-section" style="margin-top: 20px;">
                        <h4>取消原因</h4>
                        <div style="padding: 12px; background: var(--bg-light); border-radius: 6px;">${order.cancel_reason}</div>
                    </div>` : ''}
                `, '工单详情');
            } else {
                Toast.error(response.message || '获取详情失败');
            }
        } catch (error) {
            console.error('获取工单详情失败:', error);
            Toast.error('获取工单详情失败');
        }
    },

    async startOrder(id) {
        const confirmed = await Modal.confirm('确定要开始处理此工单吗？');
        if (!confirmed) return;

        try {
            const response = await MaintenanceService.updateOrderStatus(id, 'in_progress');
            if (response.code === 200) {
                Toast.success('工单已开始处理');
                this.loadOrders();
                this.loadStatistics();
            } else {
                Toast.error(response.message || '操作失败');
            }
        } catch (error) {
            console.error('更新工单状态失败:', error);
            Toast.error('操作失败');
        }
    },

    async completeOrder(id) {
        const result = await Modal.form('完成工单', `
            <div class="form-group">
                <label>完成备注</label>
                <textarea class="form-control" name="note" rows="3" placeholder="请填写维护完成备注..."></textarea>
            </div>
        `);

        if (!result) return;

        try {
            const response = await MaintenanceService.updateOrderStatus(id, 'completed', result.note);
            if (response.code === 200) {
                Toast.success('工单已完成');
                this.loadOrders();
                this.loadStatistics();
            } else {
                Toast.error(response.message || '操作失败');
            }
        } catch (error) {
            console.error('完成工单失败:', error);
            Toast.error('操作失败');
        }
    },

    async cancelOrder(id) {
        const result = await Modal.form('取消工单', `
            <div class="form-group">
                <label>取消原因 <span style="color: red;">*</span></label>
                <textarea class="form-control" name="note" rows="3" placeholder="请填写取消原因..." required></textarea>
            </div>
        `);

        if (!result || !result.note) return;

        try {
            const response = await MaintenanceService.updateOrderStatus(id, 'cancelled', result.note);
            if (response.code === 200) {
                Toast.success('工单已取消');
                this.loadOrders();
                this.loadStatistics();
            } else {
                Toast.error(response.message || '操作失败');
            }
        } catch (error) {
            console.error('取消工单失败:', error);
            Toast.error('操作失败');
        }
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

    getPriorityText(priority) {
        const map = {
            low: '低',
            medium: '中',
            high: '高',
            critical: '紧急'
        };
        return map[priority] || priority;
    },

    getPriorityClass(priority) {
        const map = {
            low: 'idle',
            medium: 'running',
            high: 'maintenance',
            critical: 'error'
        };
        return map[priority] || '';
    },

    getOrderTypeText(type) {
        const map = {
            preventive: '预防性',
            corrective: '纠正性',
            emergency: '紧急'
        };
        return map[type] || type;
    },

    getEquipmentStatusText(status) {
        const map = {
            idle: '空闲',
            error: '故障'
        };
        return map[status] || status;
    }
};

window.MaintenancePage = MaintenancePage;
