/**
 * Granular permissions for the pricing software.
 * Maps to authorization logic in server/server.js.
 *
 * Use these keys when checking user permissions (e.g. in Edit User settings).
 */

/** All possible permission keys */
export const PERMISSIONS = {
  VIEW_COSTS: 'view_costs',
  EDIT_PRICING: 'edit_pricing',
  SUBMIT_PROPOSALS: 'submit_proposals',
  APPROVE_PROPOSALS: 'approve_proposals',
  MANAGE_USERS: 'manage_users',
  VIEW_ALL_REGIONS: 'view_all_regions',
  VIEW_VARIANCE_REPORT: 'view_variance_report',
  VIEW_MARGIN_ALERTS: 'view_margin_alerts',
  VIEW_TRANSITION_ANALYSIS: 'view_transition_analysis',
  IMPORT_DATA: 'import_data'
};

/** Human-readable labels for UI */
export const PERMISSION_LABELS = {
  [PERMISSIONS.VIEW_COSTS]: 'View Costs',
  [PERMISSIONS.EDIT_PRICING]: 'Edit Pricing Strategy',
  [PERMISSIONS.SUBMIT_PROPOSALS]: 'Submit Pricing Change',
  [PERMISSIONS.APPROVE_PROPOSALS]: 'Approve Pricing Change',
  [PERMISSIONS.MANAGE_USERS]: 'Manage Users',
  [PERMISSIONS.VIEW_ALL_REGIONS]: 'View All Regions',
  [PERMISSIONS.VIEW_VARIANCE_REPORT]: 'Variance Report',
  [PERMISSIONS.VIEW_MARGIN_ALERTS]: 'Margin Alerts',
  [PERMISSIONS.VIEW_TRANSITION_ANALYSIS]: 'Transition Analysis',
  [PERMISSIONS.IMPORT_DATA]: 'Import Data'
};

/** Default permissions for each role (starting point for migration from RBAC) */
export const ROLE_PERMISSIONS = {
  admin: [
    PERMISSIONS.VIEW_COSTS,
    PERMISSIONS.EDIT_PRICING,
    PERMISSIONS.APPROVE_PROPOSALS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.VIEW_ALL_REGIONS
  ],
  manager: [
    // Managers: no cost visibility, no strategy edit, region-filtered data
  ],
  analyst: [
    PERMISSIONS.VIEW_COSTS,
    PERMISSIONS.SUBMIT_PROPOSALS,
    PERMISSIONS.VIEW_ALL_REGIONS
  ],
  outside_sales: [],
  sales_manager: [],
  sales_support: []
};

/** Get permissions for a role (default starting point) */
export function getPermissionsForRole(role) {
  return ROLE_PERMISSIONS[role] ?? [];
}

/** Check if a permission set includes a specific permission */
export function hasPermission(permissions, permission) {
  return Array.isArray(permissions) && permissions.includes(permission);
}
