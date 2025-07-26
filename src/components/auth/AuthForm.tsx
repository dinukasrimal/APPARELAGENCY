
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Users, UserPlus, LogIn } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

type UserRole = 'agent' | 'agency' | 'superuser';

const AuthForm = () => {
  const { signIn, signUp, loading } = useAuth();
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'agent' as UserRole,
    agencyId: '',
    agencyName: ''
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await signIn(loginData.email, loginData.password);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (signupData.password !== signupData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    await signUp(signupData.email, signupData.password, {
      name: signupData.name,
      role: signupData.role,
      agencyId: signupData.role === 'agency' ? signupData.agencyId : undefined,
      agencyName: signupData.role === 'agency' ? signupData.agencyName : undefined
    });
  };

  const handleDemoLogin = async (userType: 'agency' | 'superuser') => {
    const demoCredentials = {
      agency: { email: 'agent@demo.com', password: 'demo123' },
      superuser: { email: 'super@demo.com', password: 'demo123' }
    };
    
    const { email, password } = demoCredentials[userType];
    await signIn(email, password);
  };

  const handleRoleChange = (value: string) => {
    setSignupData({ ...signupData, role: value as UserRole });
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
            <CardTitle className="text-2xl text-center">Welcome</CardTitle>
            <CardDescription className="text-center">
              Sign in to your account or create a new one
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login" className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" />
                  Login
                </TabsTrigger>
                <TabsTrigger value="signup" className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-4">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="Enter your email"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="Enter your password"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    disabled={loading}
                  >
                    {loading ? 'Signing In...' : 'Sign In'}
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
                    disabled={loading}
                  >
                    <Users className="h-4 w-4" />
                    Agency User
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleDemoLogin('superuser')}
                    className="flex items-center gap-2"
                    disabled={loading}
                  >
                    <Building2 className="h-4 w-4" />
                    Superuser
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Enter your full name"
                      value={signupData.name}
                      onChange={(e) => setSignupData({ ...signupData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="Enter your email"
                      value={signupData.email}
                      onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select value={signupData.role} onValueChange={handleRoleChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="agent">Agent</SelectItem>
                        <SelectItem value="agency">Agency Manager</SelectItem>
                        <SelectItem value="superuser">Superuser</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {signupData.role === 'agency' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="agency-name">Agency Name</Label>
                        <Input
                          id="agency-name"
                          type="text"
                          placeholder="Enter agency name"
                          value={signupData.agencyName}
                          onChange={(e) => setSignupData({ ...signupData, agencyName: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="agency-id">Agency ID</Label>
                        <Input
                          id="agency-id"
                          type="text"
                          placeholder="Enter agency ID"
                          value={signupData.agencyId}
                          onChange={(e) => setSignupData({ ...signupData, agencyId: e.target.value })}
                          required
                        />
                      </div>
                    </>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Create a password"
                      value={signupData.password}
                      onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Confirm your password"
                      value={signupData.confirmPassword}
                      onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-green-600 hover:bg-green-700"
                    disabled={loading}
                  >
                    {loading ? 'Creating Account...' : 'Create Account'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthForm;
