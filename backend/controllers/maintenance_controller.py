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
    page = request.args.get('page', 1, type=int)
    size = request.args.get('size', 10, type=int)
    status = request.args.get('status')
    priority = request.args.get('priority')
    equipment_id = request.args.get('equipmentId', type=int)
    order_type = request.args.get('orderType')

    return MaintenanceService.get_orders(page, size, status, priority, equipment_id, order_type)


@maintenance_bp.route('/orders/<int:order_id>', methods=['GET'])
@login_required
def get_order(order_id):
    return MaintenanceService.get_order_by_id(order_id)


@maintenance_bp.route('/orders', methods=['POST'])
@login_required
def create_order():
    data = request.get_json()
    return MaintenanceService.create_order(data)


@maintenance_bp.route('/orders/<int:order_id>', methods=['PUT'])
@login_required
def update_order(order_id):
    data = request.get_json()
    return MaintenanceService.update_order(order_id, data)


@maintenance_bp.route('/orders/<int:order_id>/status', methods=['PUT'])
@login_required
def update_order_status(order_id):
    data = request.get_json()
    new_status = data.get('status')
    note = data.get('note')
    return MaintenanceService.update_order_status(order_id, new_status, note)


@maintenance_bp.route('/orders/<int:order_id>', methods=['DELETE'])
@login_required
def delete_order(order_id):
    return MaintenanceService.delete_order(order_id)


@maintenance_bp.route('/available-equipments', methods=['GET'])
@login_required
def get_available_equipments():
    return MaintenanceService.get_available_equipments()


@maintenance_bp.route('/statistics', methods=['GET'])
@login_required
def get_statistics():
    return MaintenanceService.get_statistics()
