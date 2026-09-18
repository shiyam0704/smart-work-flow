// Mock data for frontend prototype — will be replaced by backend queries

export type Department = {
  id: string;
  name: string;
  code: string;
  color: string;
  icon: string;
  isActive: boolean;
  sortOrder: number;
};

export type FieldDef = {
  id: string;
  label: string;
  fieldType: "text" | "number" | "date" | "select" | "checkbox" | "url" | "file";
  options?: string[];
  required: boolean;
};

export type WorkflowState = {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
};

export type Employee = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  avatar: string;
  status: "active" | "inactive";
};

export type Client = {
  id: string;
  name: string;
  logo: string;
  status: "active" | "paused" | "churned";
  retainer: number;
  group: string;
  industry: string;
  departments: string[]; // dept ids subscribed
  startDate: string;
};

export const clientGroups: string[] = [];


export type Task = {
  id: string;
  title: string;
  clientId: string;
  departmentId: string;
  assignees: string[];
  createdBy: string;
  status: string;
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string;
  description: string;
  customFields: Record<string, string | number | boolean>;
};

export const departments: Department[] = [];
export const fieldDefs: FieldDef[] = [];
export const workflowStates: WorkflowState[] = [];
export const employees: Employee[] = [];
export const clients: Client[] = [];
export const tasks: Task[] = [];

export const currentUser: Employee | undefined = undefined;

export function getDepartment(id: string) { return departments.find(d => d.id === id); }
export function getEmployee(id: string) { return employees.find(e => e.id === id); }
export function getClient(id: string) { return clients.find(c => c.id === id); }
export function getStatus(id: string) { return workflowStates.find(s => s.id === id); }
export function getTasksForClient(clientId: string) { return tasks.filter(t => t.clientId === clientId); }
export function getTasksForUser(userId: string) { return tasks.filter(t => t.assignees.includes(userId) || t.createdBy === userId); }
