"""
设备维护工单模型
"""
from database.db import db
from models.base import BaseModel
from datetime import datetime


class MaintenanceOrder(BaseModel):
    """设备维护工单模型"""
    __tablename__ = 'maintenance_order'

    order_code = db.Column(db.String(50), unique=True, nullable=False, comment='工单编号')
    order_title = db.Column(db.String(200), nullable=False, comment='工单标题')
    equipment_id = db.Column(db.BigInteger, db.ForeignKey('equipment.id'), comment='设备ID')
    maintenance_type = db.Column(db.Enum('routine', 'fault', 'preventive', 'emergency'), default='routine', comment='维护类型: routine常规/fault故障/preventive预防性/emergency紧急')
    priority = db.Column(db.Enum('low', 'medium', 'high', 'critical'), default='medium', comment='优先级: low低/medium中/high高/critical紧急')
    description = db.Column(db.Text, comment='故障描述/维护内容')
    status = db.Column(db.Enum('pending', 'in_progress', 'completed', 'cancelled'), default='pending', comment='状态: pending待处理/in_progress处理中/completed已完成/cancelled已取消')
    assignee = db.Column(db.String(50), comment='负责人')
    plan_start_time = db.Column(db.DateTime, comment='计划开始时间')
    plan_end_time = db.Column(db.DateTime, comment='计划结束时间')
    actual_start_time = db.Column(db.DateTime, comment='实际开始时间')
    actual_end_time = db.Column(db.DateTime, comment='实际结束时间')
    cost = db.Column(db.Numeric(10, 2), default=0, comment='维护费用')
    result_note = db.Column(db.Text, comment='维护结果备注')

    equipment = db.relationship('Equipment', backref='maintenance_orders', lazy='joined')

    def to_dict(self):
        result = super().to_dict()
        if self.equipment:
            result['equipment_name'] = self.equipment.equipment_name
            result['equipment_code'] = self.equipment.equipment_code
            result['equipment_status'] = self.equipment.status
        return result

    def __repr__(self):
        return f'<MaintenanceOrder {self.order_code}>'
