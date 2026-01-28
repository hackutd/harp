export const UserRole = {
  Hacker: 'hacker',
  Admin: 'admin',
  SuperAdmin: 'super_admin',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ApplicationStatus = {
  Draft: 'draft',
  Submitted: 'submitted',
  Accepted: 'accepted',
  Rejected: 'rejected',
  Waitlisted: 'waitlisted',
} as const;

export type ApplicationStatus = (typeof ApplicationStatus)[keyof typeof ApplicationStatus];

export const AuthMethod = {
  Passwordless: 'passwordless',
  Google: 'google',
} as const;

export type AuthMethod = (typeof AuthMethod)[keyof typeof AuthMethod];
