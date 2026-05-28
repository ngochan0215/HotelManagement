const CUSTOMER_ROLES = new Set(["customer", "guest", "client"]);
const ADMIN_ROLES = new Set(["manager", "admin"]);

export function normalizeAuthValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function normalizePosition(value) {
  const position = normalizeAuthValue(value);
  if (position === "housekeeping" || position === "house_keeper") return "housekeeper";
  if (position === "front_desk") return "receptionist";
  if (position === "technical" || position === "maintenance") return "technician";
  return position;
}

export function getAuthIdentity(source = {}) {
  const storedRole = localStorage.getItem("role");
  const storedPosition = localStorage.getItem("position");
  const role = normalizeAuthValue(source.role || source.system_role || source.user_role || storedRole);
  const position = normalizePosition(source.position || source.employee_position || storedPosition);
  return { role, position };
}

export function isCustomerRole(role) {
  return CUSTOMER_ROLES.has(normalizeAuthValue(role));
}

export function isAdminRole(role) {
  return ADMIN_ROLES.has(normalizeAuthValue(role));
}

export function getRoleRedirectPath(source = {}) {
  const { role, position } = getAuthIdentity(source);

  if (isCustomerRole(role)) return "/hotel/account";
  if (isAdminRole(role)) return "/dashboard";

  if (position === "receptionist") return "/room-calendar";
  if (position === "technician" || position === "housekeeper") return "/my-work";
  if (position === "accountant") return "/invoices";
  if (position === "customer_service") return "/customers";

  if (role === "employee" || role === "staff") return "/dashboard";
  return "/dashboard";
}
