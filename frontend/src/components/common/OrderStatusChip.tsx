import React from 'react';
import { ORDER_STATUS_VALUE } from '@/types';
import { labelDisplayOrderStatus } from '@/locale/enUI';
import { DISPLAY_IN_PROGRESS, type DisplayOrderStatus } from '@/utils/orderStatusDisplay';
import { Badge } from './Badge';

interface OrderStatusChipProps {
  status: DisplayOrderStatus;
}

export const OrderStatusChip: React.FC<OrderStatusChipProps> = ({ status }) => {
  const variantMap: Record<DisplayOrderStatus, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
    [ORDER_STATUS_VALUE.PENDING_OFFER]: 'info',
    [ORDER_STATUS_VALUE.OFFER_DECLINED]: 'default',
    [ORDER_STATUS_VALUE.ACCEPTED]: 'info',
    [DISPLAY_IN_PROGRESS]: 'info',
    [ORDER_STATUS_VALUE.AWAITING_SHIPPING_INFO]: 'warning',
    [ORDER_STATUS_VALUE.MEETUP_SET]: 'info',
    [ORDER_STATUS_VALUE.SHIPPED]: 'info',
    [ORDER_STATUS_VALUE.DELIVERED]: 'info',
    [ORDER_STATUS_VALUE.RECEIVED]: 'info',
    [ORDER_STATUS_VALUE.COMPLETE]: 'success',
    [ORDER_STATUS_VALUE.DISPUTE]: 'danger',
    [ORDER_STATUS_VALUE.ADMIN_RESOLVED]: 'default',
  };

  return (
    <Badge variant={variantMap[status] ?? 'default'} size="sm">
      {labelDisplayOrderStatus(status)}
    </Badge>
  );
};
