import { Link, useNavigate } from 'react-router-dom';
import { signOut } from 'supertokens-auth-react/recipe/session';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUserStore } from '@/shared/stores';

export default function DashboardPage() {
  const { user, clearUser } = useUserStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    clearUser();
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Welcome{user?.email ? `, ${user.email}` : '!'}</h1>
              <p className="text-gray-600 mt-2">Manage your hackathon journey from here</p>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              Sign Out
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Application</CardTitle>
                <CardDescription>Submit or update your application</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Complete your hacker application to participate in HackUTD
                </p>
                <Link to="/app/apply">
                  <Button className="w-full">Go to Application</Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
                <CardDescription>Check your application status</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  View the current status of your application
                </p>
                <Link to="/app/status">
                  <Button variant="outline" className="w-full">View Status</Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Important Information</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Event Date: TBA</li>
                <li>• Location: University of Texas at Dallas</li>
                <li>• Questions? Contact us at hello@hackutd.co</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
