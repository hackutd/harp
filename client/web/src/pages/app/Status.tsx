import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getRequest, errorAlert } from "../../lib/api";
import type { Application } from "../../types";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";

export default function Status() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<Application | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const res = await getRequest<Application>(
        "/v1/applications/me",
        "application"
      );
      if (res.status === 200 && res.data) {
        setApplication(res.data);
      } else if (res.status !== 404) {
        errorAlert(res);
      }
      setLoading(false);
    };

    loadData();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "accepted":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "waitlisted":
        return "bg-yellow-100 text-yellow-800";
      case "submitted":
        return "bg-blue-100 text-blue-800";
      case "draft":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusMessage = (status: string) => {
    switch (status) {
      case "accepted":
        return "Congratulations! Your application has been accepted.";
      case "rejected":
        return "Thank you for applying. Unfortunately, we cannot accept your application at this time.";
      case "waitlisted":
        return "Your application is on the waitlist. We will notify you if a spot becomes available.";
      case "submitted":
        return "Your application has been submitted and is under review. We will notify you once a decision is made.";
      case "draft":
        return "Your application is saved as a draft. Submit it when you're ready!";
      default:
        return "Your application has been received and is pending review.";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <div className="mb-6">
              <Button variant="ghost" onClick={() => navigate("/app")}>
                &larr; Back to Dashboard
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>No Application Found</CardTitle>
                <CardDescription>
                  You haven't started an application yet
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Get started by creating your hacker application.
                </p>
                <Button onClick={() => navigate("/app/apply")}>
                  Apply Now
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <Button variant="ghost" onClick={() => navigate("/app")}>
              &larr; Back to Dashboard
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Application Status</CardTitle>
              <CardDescription>
                Track the progress of your application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-sm text-gray-600 mb-2">Current Status</p>
                <Badge className={getStatusColor(application.status)}>
                  {application.status.replace("_", " ").toUpperCase()}
                </Badge>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  {getStatusMessage(application.status)}
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Application Details</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p className="text-gray-600">Name:</p>
                  <p className="font-medium">
                    {application.first_name} {application.last_name}
                  </p>

                  <p className="text-gray-600">University:</p>
                  <p className="font-medium">
                    {application.university || "Not provided"}
                  </p>

                  <p className="text-gray-600">Major:</p>
                  <p className="font-medium">
                    {application.major || "Not provided"}
                  </p>

                  {application.submitted_at && (
                    <>
                      <p className="text-gray-600">Submitted:</p>
                      <p className="font-medium">
                        {new Date(application.submitted_at).toLocaleDateString()}
                      </p>
                    </>
                  )}

                  <p className="text-gray-600">Created:</p>
                  <p className="font-medium">
                    {new Date(application.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {application.status === "draft" && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/app/apply")}
                >
                  Continue Editing Application
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
