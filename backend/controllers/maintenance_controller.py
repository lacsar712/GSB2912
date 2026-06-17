"""
设备维护工单控制器
"""
from flask import Blueprint, request

from services.maintenance_service import MaintenanceService
from middleware.auth_middleware import login_required

maintenance_bp = Blueprint('maintenance', __name__)


@maintenance_bp.route('/orders', methods=['GET'])
@login_required
def get_orders():
    """获取维护工单列表"""
    page = request.args.get('page', 1, type=int)
    size = request.args.get('size', 10, type=int)
    equipment_id = request.args.get('equipmentId', type=int)
    status = request.args.get('status')
    order_type = request.args.get('orderType')

    return MaintenanceService.get_orders(page, size, equipment_id, status, order_type)


@maintenance_bp.route('/orders/<int:order_id>', methods=['GET'])
@login_required
def get_order(order_id):
    """获取维护工单详情"""
    return MaintenanceService.get_order_by_id(order_id)


@maintenance_bp.route('/orders', methods=['POST'])
@login_required
def create_order():
    """创建维护工单"""
    data = request.get_json()
    return MaintenanceService.create_order(data)


@maintenance_bp.route('/orders/<int:order_id>', methods=['PUT'])
@login_required
def update_order(order_id):
    """更新维护工单"""
    data = request.get_json()
    return MaintenanceService.update_order(order_id, data)


@maintenance_bp.route('/orders/<int:order_id>/status', methods=['PUT'])
@login_required
def update_order_status(order_id):
    """更新工单状态"""
    data = request.get_json()
    new_status = data.get('status')
    return MaintenanceService.update_order_status(order_id, new_status)


@maintenance_bp.route('/orders/<int:order_id>', methods=['DELETE'])
@login_required
def delete_order(order_id):
    """删除维护工单"""
    return MaintenanceService.delete_order(order_id)


@maintenance_bp.route('/statistics', methods=['GET'])
@login_required
def get_statistics():
    """获取维护工单统计"""
    return MaintenanceService.get_statistics()
