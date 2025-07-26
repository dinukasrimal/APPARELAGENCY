// Odoo API Client Configuration
export interface OdooConfig {
  url: string;
  database: string;
  username: string;
  password: string;
  apiKey?: string;
}

export interface OdooAuthResponse {
  jsonrpc: string;
  id: number;
  result: {
    uid: number;
    user_context: {
      lang: string;
      tz: string;
      uid: number;
    };
    session_id: string;
  };
}

export interface OdooRequest {
  jsonrpc: string;
  method: string;
  params: any;
  id: number;
}

export interface OdooResponse<T = any> {
  jsonrpc: string;
  id: number;
  result: T;
  error?: {
    code: number;
    message: string;
    data: any;
  };
}

class OdooClient {
  private config: OdooConfig;
  private sessionId: string | null = null;
  private uid: number | null = null;

  constructor(config: OdooConfig) {
    this.config = config;
  }

  private async makeRequest<T>(endpoint: string, data: OdooRequest): Promise<OdooResponse<T>> {
    const url = `${this.config.url}/web/dataset/${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.sessionId) {
      headers['Cookie'] = `session_id=${this.sessionId}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.error) {
      throw new Error(`Odoo API error: ${result.error.message}`);
    }

    return result;
  }

  async authenticate(): Promise<boolean> {
    try {
      const authData: OdooRequest = {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          db: this.config.database,
          login: this.config.username,
          password: this.config.password,
        },
        id: 1,
      };

      const response = await this.makeRequest<OdooAuthResponse['result']>('authenticate', authData);
      
      if (response.result && response.result.uid) {
        this.uid = response.result.uid;
        this.sessionId = response.result.session_id;
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Odoo authentication failed:', error);
      return false;
    }
  }

  async callMethod<T = any>(
    model: string,
    method: string,
    params: any[] = [],
    kwargs: Record<string, any> = {}
  ): Promise<T> {
    if (!this.uid) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }

    const data: OdooRequest = {
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method,
        args: params,
        kwargs,
      },
      id: 1,
    };

    const response = await this.makeRequest<T>('call_kw', data);
    return response.result;
  }

  async searchRead<T = any>(
    model: string,
    domain: any[] = [],
    fields: string[] = [],
    offset: number = 0,
    limit: number = 0,
    order: string = ''
  ): Promise<T[]> {
    return this.callMethod<T[]>(model, 'search_read', [domain, fields, offset, limit, order]);
  }

  async create<T = any>(model: string, values: Record<string, any>): Promise<T> {
    return this.callMethod<T>(model, 'create', [values]);
  }

  async write<T = any>(model: string, ids: number | number[], values: Record<string, any>): Promise<T> {
    return this.callMethod<T>(model, 'write', [ids, values]);
  }

  async unlink<T = any>(model: string, ids: number | number[]): Promise<T> {
    return this.callMethod<T>(model, 'unlink', [ids]);
  }

  async read<T = any>(model: string, ids: number | number[], fields: string[] = []): Promise<T[]> {
    return this.callMethod<T[]>(model, 'read', [ids, fields]);
  }

  async search<T = any>(model: string, domain: any[] = [], offset: number = 0, limit: number = 0, order: string = ''): Promise<T[]> {
    return this.callMethod<T[]>(model, 'search', [domain, offset, limit, order]);
  }

  async count(model: string, domain: any[] = []): Promise<number> {
    return this.callMethod<number>(model, 'search_count', [domain]);
  }

  isAuthenticated(): boolean {
    return this.uid !== null && this.sessionId !== null;
  }

  getSessionInfo() {
    return {
      uid: this.uid,
      sessionId: this.sessionId,
    };
  }
}

// Default configuration - should be overridden with environment variables
const defaultConfig: OdooConfig = {
  url: import.meta.env.VITE_ODOO_URL || 'http://localhost:8069',
  database: import.meta.env.VITE_ODOO_DATABASE || 'odoo',
  username: import.meta.env.VITE_ODOO_USERNAME || '',
  password: import.meta.env.VITE_ODOO_PASSWORD || '',
  apiKey: import.meta.env.VITE_ODOO_API_KEY,
};

export const odooClient = new OdooClient(defaultConfig);

// Export for use in other parts of the application
export default odooClient; 