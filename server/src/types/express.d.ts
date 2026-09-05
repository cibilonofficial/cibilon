import type { Logger } from 'pino';

export interface RequestUser {
  id: string;
  name: string;
  email: string;
  status: string;
  roles: string[];
  permissions: string[];
  advisorId: string | null;
  staffId: string | null;
  sessionId: string;
}

declare global {
  namespace Express {
    interface Request {
      id: string;
      log: Logger;
      user?: RequestUser;
    }
  }
}

export {};
