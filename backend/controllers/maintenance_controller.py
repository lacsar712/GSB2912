"""
设备维护工单控制器
"""
from flask import Blueprint, request, g

from services.maintenance_service import MaintenanceService
from middleware.auth_middleware import login_required

maintenance_bp = Blueprint('maintenance', __name__)


@maintenance_bp.route('/work-orders', methods=['GET'])
@login_required
def get_work_orders():
    """获取维护工单列表"""
    page = request.args.get('page', 1, type=int)
    size = request.args.get('size', 10, type=int)
    equipment_id = request.args.get('equipmentId', type=int)
    status = request.args.get('status')
    work_order_type = request.args.get('type')

    return MaintenanceService.get_work_orders(page, size, equipment_id, status, work_order_type)


@maintenance_bp.route('/work-orders/<int:work_order_id>', methods=['GET'])
@login_required
def get_work_order(work_order_id):
    """获取维护工单详情"""
    return MaintenanceService.get_work_order_by_id(work_order_id)


@maintenance_bp.route('/work-orders', methods=['POST'])
@login_required
def create_work_order():
    """创建设备维护工单"""
    data = request.get_json()
    return MaintenanceService.create_work_order(data)


@maintenance_bp.route('/work-orders/<int:work_order_id>', methods=['PUT'])
@login_required
def update_work_order(work_order_id):
    """更新维护工单"""
    data = request.get_json()
    return MaintenanceService.update_work_order(work_order_id, data)


@maintenance_bp.route('/work-orders/<int:work_order_id>/status', methods=['PUT'])
@login_required
def update_work_order_status(work_order_id):
    """更新维护工单状态"""
    data = request.get_json()
    new_status = data.get('status')
    return MaintenanceService.update_work_order_status(work_order_id, new_status)


@maintenance_bp.route('/work-orders/<int:work_order_id>', methods=['DELETE'])
@login_required
def delete_work_order(work_order_id):
    """删除维护工单"""
    return MaintenanceService.delete_work_order(work_order_id)


@maintenance_bp.route('/available-equipments', methods=['GET'])
@login_required
def get_available_equipments():
    """获取可创建维护工单的设备列表（空闲或故障）"""
    return MaintenanceService.get_available_equipments()
