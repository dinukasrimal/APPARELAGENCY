
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'agency' | 'superuser' | 'agent';
  agencyId?: string;
  agencyName?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
