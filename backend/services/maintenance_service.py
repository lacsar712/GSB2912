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

    ALLOWED_CREATE_STATUSES = ['idle', 'error']

    @staticmethod
    def get_orders(page=1, size=10, equipment_id=None, status=None, order_type=None):
        """获取维护工单列表"""
        query = MaintenanceOrder.query

        if equipment_id:
            query = query.filter(MaintenanceOrder.equipment_id == equipment_id)
        if status:
            query = query.filter(MaintenanceOrder.status == status)
        if order_type:
            query = query.filter(MaintenanceOrder.order_type == order_type)

        pagination = query.order_by(MaintenanceOrder.priority.desc(), MaintenanceOrder.create_time.desc()).paginate(
            page=page, per_page=size, error_out=False
        )

        items = [o.to_dict() for o in pagination.items]

        return Response.paginate(items, pagination.total, page, size)

    @staticmethod
    def get_order_by_id(order_id):
        """获取维护工单详情"""
        order = MaintenanceOrder.query.filter(
            MaintenanceOrder.id == order_id
        ).first()

        if not order:
            return Response.not_found('维护工单不存在')

        order_dict = order.to_dict()

        return Response.success(order_dict)

    @staticmethod
    def create_order(data):
        """创建维护工单"""
        validation = Validator.validate_form(data, {
            'order_code': ['required'],
            'order_name': ['required'],
            'equipment_id': ['required']
        })

        if not validation['valid']:
            return Response.bad_request(list(validation['errors'].values())[0])

        if MaintenanceOrder.query.filter_by(order_code=data['order_code']).first():
            return Response.error('工单编号已存在', 409)

        equipment = Equipment.query.filter(
            Equipment.id == data['equipment_id']
        ).first()

        if not equipment:
            return Response.not_found('设备不存在')

        if equipment.status not in MaintenanceService.ALLOWED_CREATE_STATUSES:
            return Response.error(
                f'当前设备状态为「{equipment.status}」，仅允许对状态为「空闲(idle)」或「故障(error)」的设备创建维护工单',
                400
            )

        order = MaintenanceOrder(
            order_code=data['order_code'],
            order_name=data['order_name'],
            equipment_id=data['equipment_id'],
            order_type=data.get('order_type', 'preventive'),
            priority=data.get('priority', 5),
            description=data.get('description'),
            assignee=data.get('assignee'),
            planned_start_time=data.get('planned_start_time'),
            planned_end_time=data.get('planned_end_time'),
            status='pending'
        )

        try:
            order.save()
            equipment.status = 'maintenance'
            equipment.save()

            Log.add_log(g.user_id, g.username, 'create', 'maintenance_order',
                       f'创建维护工单: {order.order_name} (设备: {equipment.equipment_name})')
            return Response.created({'id': order.id}, '创建成功')
        except Exception as e:
            db.session.rollback()
            return Response.error(f'创建失败: {str(e)}')

    @staticmethod
    def update_order(order_id, data):
        """更新维护工单"""
        order = MaintenanceOrder.query.filter(
            MaintenanceOrder.id == order_id
        ).first()

        if not order:
            return Response.not_found('维护工单不存在')

        allowed = ['order_name', 'order_type', 'priority', 'description',
                  'assignee', 'planned_start_time', 'planned_end_time', 'cost', 'resolve_note']
        update_data = {k: v for k, v in data.items() if k in allowed}

        order.update(**update_data)

        Log.add_log(g.user_id, g.username, 'update', 'maintenance_order',
                   f'更新维护工单: {order.order_name}')

        return Response.success(order.to_dict(), '更新成功')

    @staticmethod
    def update_order_status(order_id, new_status):
        """更新工单状态"""
        order = MaintenanceOrder.query.filter(
            MaintenanceOrder.id == order_id
        ).first()

        if not order:
            return Response.not_found('维护工单不存在')

        valid_transitions = {
            'pending': ['in_progress', 'cancelled'],
            'in_progress': ['completed', 'cancelled'],
            'completed': [],
            'cancelled': []
        }

        current_status = order.status
        allowed_next_states = valid_transitions.get(current_status, [])

        if new_status not in allowed_next_states:
            return Response.error(f'不能从{current_status}状态变更为{new_status}状态', 400)

        order.status = new_status

        if new_status == 'in_progress' and not order.actual_start_time:
            order.actual_start_time = datetime.now()
        elif new_status == 'completed':
            order.actual_end_time = datetime.now()
        elif new_status == 'cancelled' and not order.actual_end_time:
            order.actual_end_time = datetime.now()

        try:
            order.save()

            if new_status in ['completed', 'cancelled']:
                equipment = order.equipment
                if equipment:
                    equipment.status = 'idle'
                    equipment.save()

            Log.add_log(g.user_id, g.username, 'update', 'maintenance_order',
                       f'更新工单状态: {order.order_name} ({current_status} -> {new_status})')
            return Response.success(order.to_dict(), '状态更新成功')
        except Exception as e:
            db.session.rollback()
            return Response.error(f'更新失败: {str(e)}')

    @staticmethod
    def delete_order(order_id):
        """删除维护工单"""
        order = MaintenanceOrder.query.filter(
            MaintenanceOrder.id == order_id
        ).first()

        if not order:
            return Response.not_found('维护工单不存在')

        if order.status not in ['pending', 'cancelled']:
            return Response.error('仅待处理或已取消的工单可以删除', 400)

        order.delete()

        Log.add_log(g.user_id, g.username, 'delete', 'maintenance_order',
                   f'删除维护工单: {order.order_name}')

        return Response.success(message='删除成功')

    @staticmethod
    def get_statistics():
        """获取维护工单统计"""
        total = MaintenanceOrder.query.count()
        pending = MaintenanceOrder.query.filter(MaintenanceOrder.status == 'pending').count()
        in_progress = MaintenanceOrder.query.filter(MaintenanceOrder.status == 'in_progress').count()
        completed = MaintenanceOrder.query.filter(MaintenanceOrder.status == 'completed').count()
        cancelled = MaintenanceOrder.query.filter(MaintenanceOrder.status == 'cancelled').count()

        total_cost = db.session.query(
            db.func.coalesce(db.func.sum(MaintenanceOrder.cost), 0)
        ).filter(MaintenanceOrder.status == 'completed').scalar()

        return Response.success({
            'total': total,
            'pending': pending,
            'in_progress': in_progress,
            'completed': completed,
            'cancelled': cancelled,
            'total_cost': float(total_cost) if total_cost else 0
        })
