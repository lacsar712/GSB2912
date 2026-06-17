"""
设备维护工单服务
"""
from flask import g
from datetime import datetime
from database.db import db
from models.maintenance import MaintenanceWorkOrder
from models.production import Equipment
from models.log import Log
from utils.response import Response
from utils.validator import Validator


class MaintenanceService:
    """设备维护工单服务类"""

    @staticmethod
    def get_work_orders(page=1, size=10, equipment_id=None, status=None, work_order_type=None):
        """获取维护工单列表"""
        query = MaintenanceWorkOrder.query.filter(MaintenanceWorkOrder.status != 0)

        if equipment_id:
            query = query.filter(MaintenanceWorkOrder.equipment_id == equipment_id)
        if status:
            query = query.filter(MaintenanceWorkOrder.status == status)
        if work_order_type:
            query = query.filter(MaintenanceWorkOrder.work_order_type == work_order_type)

        pagination = query.order_by(MaintenanceWorkOrder.create_time.desc()).paginate(
            page=page, per_page=size, error_out=False
        )

        items = [wo.to_dict() for wo in pagination.items]

        return Response.paginate(items, pagination.total, page, size)

    @staticmethod
    def get_work_order_by_id(work_order_id):
        """获取维护工单详情"""
        work_order = MaintenanceWorkOrder.get_by_id(work_order_id)
        if not work_order:
            return Response.not_found('维护工单不存在')

        wo_dict = work_order.to_dict()
        if work_order.equipment:
            wo_dict['equipment'] = work_order.equipment.to_dict()

        return Response.success(wo_dict)

    @staticmethod
    def create_work_order(data):
        """创建维护工单"""
        validation = Validator.validate_form(data, {
            'work_order_code': ['required'],
            'equipment_id': ['required'],
            'title': ['required']
        })

        if not validation['valid']:
            return Response.bad_request(list(validation['errors'].values())[0])

        if MaintenanceWorkOrder.query.filter_by(work_order_code=data['work_order_code']).first():
            return Response.error('工单编号已存在', 409)

        equipment = Equipment.get_by_id(data['equipment_id'])
        if not equipment:
            return Response.not_found('设备不存在')

        if equipment.status not in ('idle', 'error'):
            return Response.error(
                f'仅允许对状态为"空闲(idle)"或"故障(error)"的设备创建维护工单，当前设备状态为"{equipment.status}"',
                400
            )

        work_order = MaintenanceWorkOrder(
            work_order_code=data['work_order_code'],
            equipment_id=data['equipment_id'],
            title=data['title'],
            description=data.get('description'),
            work_order_type=data.get('work_order_type', 'corrective'),
            priority=data.get('priority', 5),
            assignee=data.get('assignee'),
            planned_start_time=data.get('planned_start_time'),
            planned_end_time=data.get('planned_end_time'),
            status='pending'
        )

        try:
            work_order.save()

            equipment.status = 'maintenance'
            equipment.save()

            Log.add_log(g.user_id, g.username, 'create', 'maintenance_work_order',
                       f'创建设备维护工单: {work_order.work_order_code} - {work_order.title}')
            return Response.created({'id': work_order.id}, '创建成功')
        except Exception as e:
            db.session.rollback()
            return Response.error(f'创建失败: {str(e)}')

    @staticmethod
    def update_work_order(work_order_id, data):
        """更新维护工单"""
        work_order = MaintenanceWorkOrder.get_by_id(work_order_id)
        if not work_order:
            return Response.not_found('维护工单不存在')

        allowed = ['title', 'description', 'work_order_type', 'priority',
                  'assignee', 'planned_start_time', 'planned_end_time', 'result', 'cost']
        update_data = {k: v for k, v in data.items() if k in allowed}

        work_order.update(**update_data)

        Log.add_log(g.user_id, g.username, 'update', 'maintenance_work_order',
                   f'更新维护工单: {work_order.work_order_code}')

        return Response.success(work_order.to_dict(), '更新成功')

    @staticmethod
    def update_work_order_status(work_order_id, new_status):
        """更新维护工单状态"""
        work_order = MaintenanceWorkOrder.get_by_id(work_order_id)
        if not work_order:
            return Response.not_found('维护工单不存在')

        valid_transitions = {
            'pending': ['in_progress', 'cancelled'],
            'in_progress': ['completed', 'cancelled'],
            'completed': [],
            'cancelled': []
        }

        current_status = work_order.status
        allowed_next_states = valid_transitions.get(current_status, [])

        if new_status not in allowed_next_states:
            return Response.error(f'不能从{current_status}状态变更为{new_status}状态', 400)

        work_order.status = new_status

        now = datetime.now()
        if new_status == 'in_progress' and not work_order.actual_start_time:
            work_order.actual_start_time = now
        elif new_status in ('completed', 'cancelled'):
            work_order.actual_end_time = now

            if work_order.equipment_id:
                equipment = Equipment.get_by_id(work_order.equipment_id)
                if equipment:
                    if new_status == 'completed':
                        equipment.status = 'idle'
                    elif new_status == 'cancelled':
                        equipment.status = 'idle'
                    equipment.save()

        try:
            work_order.save()
            Log.add_log(g.user_id, g.username, 'update', 'maintenance_work_order',
                       f'更新维护工单状态: {work_order.work_order_code} ({current_status} -> {new_status})')
            return Response.success(work_order.to_dict(), '状态更新成功')
        except Exception as e:
            db.session.rollback()
            return Response.error(f'更新失败: {str(e)}')

    @staticmethod
    def delete_work_order(work_order_id):
        """删除维护工单"""
        work_order = MaintenanceWorkOrder.get_by_id(work_order_id)
        if not work_order:
            return Response.not_found('维护工单不存在')

        work_order.delete()

        if work_order.equipment_id:
            equipment = Equipment.get_by_id(work_order.equipment_id)
            if equipment and equipment.status == 'maintenance':
                equipment.status = 'idle'
                equipment.save()

        Log.add_log(g.user_id, g.username, 'delete', 'maintenance_work_order',
                   f'删除维护工单: {work_order.work_order_code}')

        return Response.success(message='删除成功')

    @staticmethod
    def get_available_equipments():
        """获取可创建维护工单的设备列表（空闲或故障状态）"""
        equipments = Equipment.query.filter(
            Equipment.status.in_(['idle', 'error'])
        ).order_by(Equipment.create_time.desc()).all()

        items = [{
            'id': e.id,
            'equipment_code': e.equipment_code,
            'equipment_name': e.equipment_name,
            'equipment_type': e.equipment_type,
            'status': e.status
        } for e in equipments]

        return Response.success(items)
