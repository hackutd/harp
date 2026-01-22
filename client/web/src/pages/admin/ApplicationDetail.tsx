import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getRequest, putRequest, errorAlert } from "../../lib/api";
import type { Application, ApplicationStatus } from "../../types";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [application, setApplication] = useState<Application | null>(null);
  const [newStatus, setNewStatus] = useState<ApplicationStatus>("pending");

  useEffect(() => {
    const loadData = async () => {
      const res = await getRequest<Application>(
        `/v1/admin/applications/${id}`,
        "application"
      );
      if (res.status === 200 && res.data) {
        setApplication(res.data);
        setNewStatus(res.data.status);
      } else {
        errorAlert(res);
        navigate("/admin/applications");
      }
      setLoading(false);
    };

    loadData();
  }, [id, navigate]);

  const handleStatusUpdate = async () => {
    if (!application) return;

    setUpdating(true);
    const res = await putRequest<Application>(
      `/v1/admin/applications/${id}`,
      { status: newStatus },
      "application status"
    );

    if (res.status === 200 && res.data) {
      setApplication(res.data);
      alert("Status updated successfully");
    } else {
      errorAlert(res);
    }
    setUpdating(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "accepted":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "waitlisted":
        return "bg-yellow-100 text-yellow-800";
      case "in_review":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
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
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => navigate("/admin/applications")}
            >
              ← Back to Applications
            </Button>
          </div>

          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      {application.firstName} {application.lastName}
                    </CardTitle>
                    <CardDescription>{application.email}</CardDescription>
                  </div>
                  <Badge className={getStatusColor(application.status)}>
                    {application.status.replace("_", " ").toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">
                    Personal Information
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-600">School</Label>
                      <p className="font-medium">{application.school}</p>
                    </div>
                    <div>
                      <Label className="text-gray-600">Major</Label>
                      <p className="font-medium">{application.major}</p>
                    </div>
                    <div>
                      <Label className="text-gray-600">Graduation Year</Label>
                      <p className="font-medium">
                        {application.graduationYear}
                      </p>
                    </div>
                    {application.shirtSize && (
                      <div>
                        <Label className="text-gray-600">Shirt Size</Label>
                        <p className="font-medium">{application.shirtSize}</p>
                      </div>
                    )}
                  </div>
                </div>

                {application.dietaryRestrictions && (
                  <div>
                    <Label className="text-gray-600">
                      Dietary Restrictions
                    </Label>
                    <p className="mt-1">{application.dietaryRestrictions}</p>
                  </div>
                )}

                {(application.github || application.linkedin) && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Links</h3>
                    <div className="space-y-2">
                      {application.github && (
                        <div>
                          <Label className="text-gray-600">GitHub</Label>
                          <p>
                            <a
                              href={application.github}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              {application.github}
                            </a>
                          </p>
                        </div>
                      )}
                      {application.linkedin && (
                        <div>
                          <Label className="text-gray-600">LinkedIn</Label>
                          <p>
                            <a
                              href={application.linkedin}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              {application.linkedin}
                            </a>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-lg font-semibold mb-4">Timeline</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-600">Submitted</Label>
                      <p className="font-medium">
                        {new Date(application.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <Label className="text-gray-600">Last Updated</Label>
                      <p className="font-medium">
                        {new Date(application.updatedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Update Status</CardTitle>
                <CardDescription>Change the application status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={newStatus}
                      onValueChange={(value) =>
                        setNewStatus(value as ApplicationStatus)
                      }
                    >
                      <SelectTrigger id="status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_review">In Review</SelectItem>
                        <SelectItem value="accepted">Accepted</SelectItem>
                        <SelectItem value="waitlisted">Waitlisted</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleStatusUpdate}
                    disabled={updating || newStatus === application.status}
                    className="w-full"
                  >
                    {updating ? "Updating..." : "Update Status"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
