import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Home, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-800 border border-slate-700">
          <span className="text-4xl font-bold text-teal-400">404</span>
        </div>
        <h1 className="mb-2 text-2xl font-bold text-white">Page Not Found</h1>
        <p className="mb-8 text-slate-400 max-w-sm">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild className="bg-teal-500 hover:bg-teal-600">
            <Link to="/">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800">
            <Link to="/chat">
              <MessageSquare className="mr-2 h-4 w-4" />
              Open Chat
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
