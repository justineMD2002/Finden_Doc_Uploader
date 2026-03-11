// SAP B1 Copy From / Copy To relationships and BaseType codes

import { BIZ_OBJECTS } from '@/types/wizard'

/** SAP Service Layer object type codes — used as BaseType on document lines. */
export const BASE_TYPE_CODES: Record<string, number> = {
  po:             22,
  grpo:           20,
  ap_invoice:     18,
  ap_downpayment: 204,
  ar_invoice:     13,
  delivery:       15,
  return:         16,
  ar_credit_memo: 14,
  goods_issue:    60,
  goods_receipt:  59,
  inv_transfer:   67,
}

/**
 * Valid copy-from edges: target biz object id → array of source biz object ids.
 * Only objects listed here will show a "Copy From" panel in Step 1.
 */
export const COPY_FROM_EDGES: Record<string, string[]> = {
  grpo:           ['po'],
  ap_downpayment: ['po'],
  ap_invoice:     ['grpo', 'ap_downpayment'],
  ar_invoice:     ['delivery'],
  return:         ['delivery', 'ar_invoice'],
  ar_credit_memo: ['ar_invoice'],
}

/** Returns the valid source biz object ids that can be copied into the given target. */
export function getCopyFromSources(targetId: string): string[] {
  return COPY_FROM_EDGES[targetId] ?? []
}

/** Returns the human-readable label for a biz object id. */
export function getBizObjectLabel(id: string): string {
  return BIZ_OBJECTS.find(b => b.id === id)?.label ?? id
}
