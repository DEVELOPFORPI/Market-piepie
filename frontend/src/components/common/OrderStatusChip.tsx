import React from 'react';
import { OrderStatus, ORDER_STATUS_VALUE } from '@/types';
import { labelOrderStatus } from '@/locale/enUI';
import { Badge } from './Badge';

interface OrderStatusChipProps {
  status: OrderStatus;
}

export const OrderStatusChip: React.FC<OrderStatusChipProps> = ({ status }) => {
  const variantMap: Record<OrderStatus, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
    [ORDER_STATUS_VALUE.PENDING_OFFER]: 'info',
    [ORDER_STATUS_VALUE.ACCEPTED]: 'info',
    [ORDER_STATUS_VALUE.AWAITING_SHIPPING_INFO]: 'warning',
    [ORDER_STATUS_VALUE.MEETUP_SET]: 'info',
    [ORDER_STATUS_VALUE.SHIPPED]: 'info',
    [ORDER_STATUS_VALUE.DELIVERED]: 'info',
    [ORDER_STATUS_VALUE.RECEIVED]: 'info',
    [ORDER_STATUS_VALUE.COMPLETE]: 'success',
    [ORDER_STATUS_VALUE.DISPUTE]: 'danger',
  };

  return (
    <Badge variant={variantMap[status] ?? 'default'} size="sm">
      {labelOrderStatus(status)}
    </Badge>
  );
};
