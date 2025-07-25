import { API_CONFIG, apiCall } from '../config/api';

export interface User {
  userId: string;
  email: string;
  role: 'user' | 'admin';
  profile?: {
    firstName?: string;
    lastName?: string;
    company?: string;
    phone?: string;
  };
  subscription?: {
    plan: 'free' | 'basic' | 'pro' | 'enterprise';
    status: 'active' | 'inactive' | 'cancelled';
    expiresAt?: string;
  };
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  company?: string;
}

class AuthService {
  private tokenKey = 'authToken';
  private userKey = 'userData';

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH_LOGIN}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data: LoginResponse = await response.json();
    this.setAuthData(data.token, data.user);
    return data;
  }

  async register(userData: RegisterData): Promise<LoginResponse> {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH_REGISTER}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Registration failed');
    }

    const data: LoginResponse = await response.json();
    this.setAuthData(data.token, data.user);
    return data;
  }

  async adminLogin(pin: string): Promise<LoginResponse> {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH_ADMIN_LOGIN}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pin }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Admin login failed');
    }

    const data: LoginResponse = await response.json();
    this.setAuthData(data.token, data.user);
    return data;
  }

  async verifyToken(): Promise<{ valid: boolean; user?: User }> {
    const token = this.getToken();
    if (!token) {
      return { valid: false };
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH_VERIFY_TOKEN}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        this.logout();
        return { valid: false };
      }

      const data = await response.json();
      if (data.valid) {
        this.setUser(data.user);
        return { valid: true, user: data.user };
      } else {
        this.logout();
        return { valid: false };
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      this.logout();
      return { valid: false };
    }
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getUser(): User | null {
    const userData = localStorage.getItem(this.userKey);
    return userData ? JSON.parse(userData) : null;
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  isAdmin(): boolean {
    const user = this.getUser();
    return user?.role === 'admin';
  }

  private setAuthData(token: string, user: User): void {
    localStorage.setItem(this.tokenKey, token);
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  private setUser(user: User): void {
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }
}

export const authService = new AuthService();
export default authService;