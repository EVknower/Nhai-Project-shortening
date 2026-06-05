export const DEPARTMENTS = [
  'IT',
  'HR',
  'Finance',
  'Operations',
  'Security',
  'Admin',
  'Engineering',
  'Sales',
] as const;

export type Department = (typeof DEPARTMENTS)[number];

export interface Employee {
  id: string;
  name: string;
  employeeCode: string;
  department: Department;
  isActive: boolean;
  enrolledAt: number | null;
  syncedAt: number | null;
  createdAt: number;
}

export type EmployeeCreateInput = Pick<
  Employee,
  'name' | 'employeeCode' | 'department'
>;

export type EmployeeUpdateInput = Partial<
  Pick<Employee, 'name' | 'department' | 'isActive' | 'enrolledAt' | 'syncedAt'>
>;
