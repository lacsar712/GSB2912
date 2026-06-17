"""
设备维护工单服务
"""
from flask import g
from datetime import datetime
from database.db import db
from models.maintenance import MaintenanceOrder
from models.production import Equipment
from models.log import Log
from utils.response import Response
from utils.validator import Validator


class MaintenanceService:
    """设备维护工单服务类"""

    ALLOWED_EQUIPMENT_STATUSES = ('idle', 'error')

    VALID_STATUS_TRANSITIONS = {
        'pending': ['in_progress', 'cancelled'],
        'in_progress': ['completed', 'cancelled'],
        'completed': [],
        'cancelled': []
    }

    @staticmethod
    def get_orders(page=1, size=10, status=None, priority=None, equipment_id=None, order_type=None):
        query = MaintenanceOrder.query

        if status:
            query = query.filter(MaintenanceOrder.status == status)
        if priority:
            query = query.filter(MaintenanceOrder.priority == priority)
        if equipment_id:
            query = query.filter(MaintenanceOrder.equipment_id == equipment_id)
        if order_type:
            query = query.filter(MaintenanceOrder.order_type == order_type)

        pagination = query.order_by(MaintenanceOrder.create_time.desc()).paginate(
            page=page, per_page=size, error_out=False
        )

        items = [order.to_dict() for order in pagination.items]
        return Response.paginate(items, pagination.total, page, size)

    @staticmethod
    def get_order_by_id(order_id):
        order = MaintenanceOrder.query.filter(MaintenanceOrder.id == order_id).first()
        if not order:
            return Response.not_found('维护工单不存在')
        return Response.success(order.to_dict())

    @staticmethod
    def create_order(data):
        validation = Validator.validate_form(data, {
            'order_code': ['required'],
            'equipment_id': ['required']
        })

        if not validation['valid']:
            return Response.bad_request(list(validation['errors'].values())[0])

        if MaintenanceOrder.query.filter_by(order_code=data['order_code']).first():
            return Response.error('工单编号已存在', 409)

        equipment = Equipment.query.filter(Equipment.id == data['equipment_id']).first()
        if not equipment:
            return Response.not_found('设备不存在')

        if equipment.status not in MaintenanceService.ALLOWED_EQUIPMENT_STATUSES:
            return Response.bad_request(
                f'仅允许对状态为空闲或故障的设备创建维护工单，当前设备状态为: {equipment.status}'
            )

        order = MaintenanceOrder(
            order_code=data['order_code'],
            equipment_id=data['equipment_id'],
            order_type=data.get('order_type', 'corrective'),
            priority=data.get('priority', 'medium'),
            description=data.get('description'),
            assignee=data.get('assignee'),
            planned_start_time=data.get('planned_start_time'),
            planned_end_time=data.get('planned_end_time'),
            status='pending'
        )

        try:
            order.save()
            equipment.status = 'maintenance'
            db.session.commit()
            Log.add_log(g.user_id, g.username, 'create', 'maintenance_order',
                       f'创建维护工单: {order.order_code}')
            return Response.created({'id': order.id}, '创建成功')
        except Exception as e:
            db.session.rollback()
            return Response.error(f'创建失败: {str(e)}')

    @staticmethod
    def update_order(order_id, data):
        order = MaintenanceOrder.query.filter(MaintenanceOrder.id == order_id).first()
        if not order:
            return Response.not_found('维护工单不存在')

        allowed = ['order_type', 'priority', 'description', 'assignee',
                   'planned_start_time', 'planned_end_time']
        update_data = {k: v for k, v in data.items() if k in allowed}
        order.update(**update_data)

        Log.add_log(g.user_id, g.username, 'update', 'maintenance_order',
                   f'更新维护工单: {order.order_code}')
        return Response.success(order.to_dict(), '更新成功')

    @staticmethod
    def update_order_status(order_id, new_status, note=None):
        order = MaintenanceOrder.query.filter(MaintenanceOrder.id == order_id).first()
        if not order:
            return Response.not_found('维护工单不存在')

        allowed_next = MaintenanceService.VALID_STATUS_TRANSITIONS.get(order.status, [])
        if new_status not in allowed_next:
            return Response.error(
                f'不能从{order.status}状态变更为{new_status}状态', 400
            )

        order.status = new_status

        if new_status == 'in_progress':
            order.actual_start_time = datetime.now()
        elif new_status == 'completed':
            order.actual_end_time = datetime.now()
            order.completion_note = note
            equipment = Equipment.query.filter(Equipment.id == order.equipment_id).first()
            if equipment:
                equipment.status = 'idle'
        elif new_status == 'cancelled':
            order.cancel_reason = note
            equipment = Equipment.query.filter(Equipment.id == order.equipment_id).first()
            if equipment and equipment.status == 'maintenance':
                equipment.status = 'idle'

        try:
            db.session.commit()
            Log.add_log(g.user_id, g.username, 'update_status', 'maintenance_order',
                       f'更新工单状态: {order.order_code} ({order.status} -> {new_status})')
            return Response.success(order.to_dict(), '状态更新成功')
        except Exception as e:
            db.session.rollback()
            return Response.error(f'更新失败: {str(e)}')

    @staticmethod
    def delete_order(order_id):
        order = MaintenanceOrder.query.filter(MaintenanceOrder.id == order_id).first()
        if not order:
            return Response.not_found('维护工单不存在')

        if order.status not in ('pending', 'cancelled'):
            return Response.bad_request('仅待处理或已取消的工单可删除')

        if order.status == 'pending':
            equipment = Equipment.query.filter(Equipment.id == order.equipment_id).first()
            if equipment and equipment.status == 'maintenance':
                equipment.status = 'idle'

        try:
            db.session.delete(order)
            db.session.commit()
            Log.add_log(g.user_id, g.username, 'delete', 'maintenance_order',
                       f'删除维护工单: {order.order_code}')
            return Response.success(message='删除成功')
        except Exception as e:
            db.session.rollback()
            return Response.error(f'删除失败: {str(e)}')

    @staticmethod
    def get_available_equipments():
        equipments = Equipment.query.filter(
            Equipment.status.in_(MaintenanceService.ALLOWED_EQUIPMENT_STATUSES)
        ).all()
        return Response.success([e.to_dict() for e in equipments])

    @staticmethod
    def get_statistics():
        total = MaintenanceOrder.query.count()
        pending = MaintenanceOrder.query.filter(MaintenanceOrder.status == 'pending').count()
        in_progress = MaintenanceOrder.query.filter(MaintenanceOrder.status == 'in_progress').count()
        completed = MaintenanceOrder.query.filter(MaintenanceOrder.status == 'completed').count()
        cancelled = MaintenanceOrder.query.filter(MaintenanceOrder.status == 'cancelled').count()

        critical = MaintenanceOrder.query.filter(
            MaintenanceOrder.priority == 'critical',
            MaintenanceOrder.status.in_(['pending', 'in_progress'])
        ).count()

        return Response.success({
            'total': total,
            'pending': pending,
            'in_progress': in_progress,
            'completed': completed,
            'cancelled': cancelled,
            'critical_active': critical
        })
