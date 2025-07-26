
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { User, LoginCredentials } from '@/types/auth';
import { Building2, Users } from 'lucide-react';

interface LoginFormProps {
  onLogin: (user: User) => void;
}

const LoginForm = ({ onLogin }: LoginFormProps) => {
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  // Demo users for testing
  const demoUsers = [
    {
      id: '1',
      name: 'John Agent',
      email: 'agent@demo.com',
      role: 'agency' as const,
      agencyId: 'agency-1',
      agencyName: 'North Region Agency'
    },
    {
      id: '2',
      name: 'Sarah Manager',
      email: 'super@demo.com',
      role: 'superuser' as const
    }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      const user = demoUsers.find(u => u.email === credentials.email);
      if (user) {
        onLogin(user);
      } else {
        alert('Invalid credentials. Try agent@demo.com or super@demo.com');
      }
      setIsLoading(false);
    }, 1000);
  };

  const handleDemoLogin = (userType: 'agency' | 'superuser') => {
    const user = demoUsers.find(u => u.role === userType);
    if (user) {
      onLogin(user);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="bg-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Building2 className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Sales Management</h1>
          <p className="text-gray-600">Agency & Team Portal</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Sign In</CardTitle>
            <CardDescription className="text-center">
              Enter your credentials to access the system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={credentials.email}
                  onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                  required
                />
              </div>
              <Button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={isLoading}
              >
                {isLoading ? 'Signing In...' : 'Sign In'}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">Demo Access</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => handleDemoLogin('agency')}
                className="flex items-center gap-2"
              >
                <Users className="h-4 w-4" />
                Agency User
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDemoLogin('superuser')}
                className="flex items-center gap-2"
              >
                <Building2 className="h-4 w-4" />
                Superuser
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginForm;
