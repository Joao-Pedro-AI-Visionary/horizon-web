export const ADMIN_ROUTE_NAMES = ['sources', 'metrics'] as const

export function isAdminRouteName(name: unknown): boolean {
  return (ADMIN_ROUTE_NAMES as readonly string[]).includes(String(name))
}
