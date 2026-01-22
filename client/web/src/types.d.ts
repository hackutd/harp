// Shared TypeScript interfaces and types

export type UserRole = 'hacker' | 'admin' | 'super_admin';

export type ApplicationStatus =
  | 'pending'
  | 'in_review'
  | 'accepted'
  | 'rejected'
  | 'waitlisted';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface Application {
  id: string;
  userId: string;
  status: ApplicationStatus;
  firstName: string;
  lastName: string;
  email: string;
  school: string;
  major: string;
  graduationYear: number;
  shirtSize?: string;
  dietaryRestrictions?: string;
  resume?: string;
  github?: string;
  linkedin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T = unknown> {
  status: number;
  data?: T;
  error?: string;
}

export interface Scan {
  id: string;
  userId: string;
  eventType: string;
  scannedAt: string;
  scannedBy: string;
}
