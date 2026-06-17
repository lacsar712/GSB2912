"""
设备维护工单模型
"""
from datetime import datetime
from database.db import db
from models.base import BaseModel


class MaintenanceOrder(BaseModel):
    """设备维护工单模型"""
    __tablename__ = 'maintenance_order'

    order_code = db.Column(db.String(50), unique=True, nullable=False, comment='工单编号')
    equipment_id = db.Column(db.BigInteger, db.ForeignKey('equipment.id'), nullable=False, comment='设备ID')
    order_type = db.Column(db.Enum('preventive', 'corrective', 'emergency'), default='corrective', comment='工单类型: 预防性/纠正性/紧急')
    priority = db.Column(db.Enum('low', 'medium', 'high', 'critical'), default='medium', comment='优先级')
    status = db.Column(db.Enum('pending', 'in_progress', 'completed', 'cancelled'), default='pending', comment='状态')
    description = db.Column(db.Text, comment='问题描述')
    assignee = db.Column(db.String(50), comment='负责人')
    planned_start_time = db.Column(db.DateTime, comment='计划开始时间')
    planned_end_time = db.Column(db.DateTime, comment='计划结束时间')
    actual_start_time = db.Column(db.DateTime, comment='实际开始时间')
    actual_end_time = db.Column(db.DateTime, comment='实际结束时间')
    completion_note = db.Column(db.Text, comment='完成备注')
    cancel_reason = db.Column(db.Text, comment='取消原因')

    equipment = db.relationship('Equipment', backref='maintenance_orders')

    def to_dict(self):
        result = super().to_dict()
        result['equipment_name'] = self.equipment.equipment_name if self.equipment else None
        result['equipment_code'] = self.equipment.equipment_code if self.equipment else None
        result['equipment_status'] = self.equipment.status if self.equipment else None
        return result

    def __repr__(self):
        return f'<MaintenanceOrder {self.order_code}>'
