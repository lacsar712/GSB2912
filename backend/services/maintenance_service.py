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

    @staticmethod
    def get_orders(page=1, size=10, equipment_id=None, status=None, priority=None, maintenance_type=None):
        """获取维护工单列表"""
        query = MaintenanceOrder.query

        if equipment_id:
            query = query.filter(MaintenanceOrder.equipment_id == equipment_id)
        if status:
            query = query.filter(MaintenanceOrder.status == status)
        if priority:
            query = query.filter(MaintenanceOrder.priority == priority)
        if maintenance_type:
            query = query.filter(MaintenanceOrder.maintenance_type == maintenance_type)

        pagination = query.order_by(MaintenanceOrder.create_time.desc()).paginate(
            page=page, per_page=size, error_out=False
        )

        items = [order.to_dict() for order in pagination.items]

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
        """创建设备维护工单"""
        validation = Validator.validate_form(data, {
            'order_code': ['required'],
            'order_title': ['required'],
            'equipment_id': ['required', 'integer']
        })

        if not validation['valid']:
            return Response.bad_request(list(validation['errors'].values())[0])

        if MaintenanceOrder.query.filter_by(order_code=data['order_code']).first():
            return Response.error('工单编号已存在', 409)

        equipment = Equipment.query.filter_by(id=data['equipment_id']).first()
        if not equipment:
            return Response.not_found('设备不存在')

        if equipment.status not in ('idle', 'error'):
            return Response.error(
                f'仅允许对状态为空闲(idle)或故障(error)的设备创建维护工单，当前设备状态: {equipment.status}',
                400
            )

        plan_start_time = data.get('plan_start_time')
        plan_end_time = data.get('plan_end_time')
        if plan_start_time:
            plan_start_time = datetime.strptime(plan_start_time, '%Y-%m-%d %H:%M:%S') if isinstance(plan_start_time, str) else plan_start_time
        if plan_end_time:
            plan_end_time = datetime.strptime(plan_end_time, '%Y-%m-%d %H:%M:%S') if isinstance(plan_end_time, str) else plan_end_time

        order = MaintenanceOrder(
            order_code=data['order_code'],
            order_title=data['order_title'],
            equipment_id=data['equipment_id'],
            maintenance_type=data.get('maintenance_type', 'routine'),
            priority=data.get('priority', 'medium'),
            description=data.get('description'),
            assignee=data.get('assignee'),
            plan_start_time=plan_start_time,
            plan_end_time=plan_end_time,
            status='pending'
        )

        try:
            order.save()
            Log.add_log(g.user_id, g.username, 'create', 'maintenance_order',
                       f'创建设备维护工单: {order.order_title} ({order.order_code})')
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

        allowed = ['order_title', 'description', 'maintenance_type', 'priority',
                  'assignee', 'plan_start_time', 'plan_end_time', 'cost', 'result_note']
        update_data = {}
        for k, v in data.items():
            if k in allowed:
                if k in ('plan_start_time', 'plan_end_time') and v and isinstance(v, str):
                    update_data[k] = datetime.strptime(v, '%Y-%m-%d %H:%M:%S')
                else:
                    update_data[k] = v

        order.update(**update_data)

        Log.add_log(g.user_id, g.username, 'update', 'maintenance_order',
                   f'更新维护工单: {order.order_title}')

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
        elif new_status in ('completed', 'cancelled'):
            order.actual_end_time = datetime.now()

        try:
            order.save()

            if new_status == 'in_progress':
                equipment = Equipment.query.filter_by(id=order.equipment_id).first()
                if equipment:
                    equipment.status = 'maintenance'
                    equipment.save()

            if new_status == 'completed':
                equipment = Equipment.query.filter_by(id=order.equipment_id).first()
                if equipment and equipment.status == 'maintenance':
                    equipment.status = 'idle'
                    equipment.save()

            Log.add_log(g.user_id, g.username, 'update', 'maintenance_order',
                       f'更新维护工单状态: {order.order_title} ({current_status} -> {new_status})')
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

        order.delete()

        Log.add_log(g.user_id, g.username, 'delete', 'maintenance_order',
                   f'删除维护工单: {order.order_title}')

        return Response.success(message='删除成功')

    @staticmethod
    def get_statistics():
        """获取维护工单统计数据"""
        total = MaintenanceOrder.query.count()
        pending = MaintenanceOrder.query.filter(MaintenanceOrder.status == 'pending').count()
        in_progress = MaintenanceOrder.query.filter(MaintenanceOrder.status == 'in_progress').count()
        completed = MaintenanceOrder.query.filter(MaintenanceOrder.status == 'completed').count()
        cancelled = MaintenanceOrder.query.filter(MaintenanceOrder.status == 'cancelled').count()

        total_cost = db.session.query(db.func.sum(MaintenanceOrder.cost)).filter(
            MaintenanceOrder.status == 'completed'
        ).scalar() or 0

        return Response.success({
            'total': total,
            'pending': pending,
            'in_progress': in_progress,
            'completed': completed,
            'cancelled': cancelled,
            'total_cost': float(total_cost)
        })
