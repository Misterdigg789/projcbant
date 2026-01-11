import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePrivy } from '@privy-io/react-auth';
import { useEffect } from "react";

export default function NotFound() {
  const { user } = useAuth();
  const { login } = usePrivy();

  // If user is not authenticated, trigger Privy login modal
  useEffect(() => {
    if (!user) {
      login();
    }
  }, [user, login]);

  // If user is not authenticated, show loading while Privy modal appears
  if (!user) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // For authenticated users, show the 404 page
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            Did you forget to add the page to the router?
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
