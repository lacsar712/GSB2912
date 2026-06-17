"""
设备维护工单模型
"""
from database.db import db
from models.base import BaseModel
from models.production import Equipment


class MaintenanceOrder(BaseModel):
    """设备维护工单模型"""
    __tablename__ = 'maintenance_order'

    order_code = db.Column(db.String(50), unique=True, nullable=False, comment='工单编号')
    order_name = db.Column(db.String(100), nullable=False, comment='工单名称')
    equipment_id = db.Column(db.BigInteger, db.ForeignKey('equipment.id'), nullable=False, comment='设备ID')
    order_type = db.Column(db.Enum('preventive', 'corrective', 'emergency'), default='preventive', comment='维护类型: preventive-预防性/corrective-修复性/emergency-紧急')
    priority = db.Column(db.Integer, default=5, comment='优先级(1-10)')
    description = db.Column(db.Text, comment='故障描述/维护内容')
    status = db.Column(db.Enum('pending', 'in_progress', 'completed', 'cancelled'), default='pending', comment='工单状态')
    assignee = db.Column(db.String(50), comment='负责人')
    planned_start_time = db.Column(db.DateTime, comment='计划开始时间')
    planned_end_time = db.Column(db.DateTime, comment='计划结束时间')
    actual_start_time = db.Column(db.DateTime, comment='实际开始时间')
    actual_end_time = db.Column(db.DateTime, comment='实际结束时间')
    cost = db.Column(db.Numeric(10, 2), default=0, comment='维护费用')
    resolve_note = db.Column(db.Text, comment='解决备注')

    equipment = db.relationship('Equipment', backref=db.backref('maintenance_orders', lazy='dynamic'))

    def to_dict(self):
        result = super().to_dict()
        try:
            if self.equipment:
                result['equipment_code'] = self.equipment.equipment_code
                result['equipment_name'] = self.equipment.equipment_name
                result['equipment_status'] = self.equipment.status
        except Exception:
            result['equipment_code'] = None
            result['equipment_name'] = None
            result['equipment_status'] = None
        return result

    def __repr__(self):
        return f'<MaintenanceOrder {self.order_code}>'
