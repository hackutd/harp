import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { getRequest, putRequest, errorAlert } from "@/lib/api";
import type { Application, ApplicationStatus } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [application, setApplication] = useState<Application | null>(null);
  const [newStatus, setNewStatus] =
    useState<ApplicationStatus>("submitted");

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
      toast.success("Status updated successfully");
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
      case "submitted":
        return "bg-blue-100 text-blue-800";
      case "draft":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1">
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
    <div className="space-y-6 max-w-4xl">
      <div>
        <Button
          variant="ghost"
          onClick={() => navigate("/admin/applications")}
        >
          &larr; Back to Applications
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Header Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {application.first_name} {application.last_name}
                </CardTitle>
                <CardDescription>
                  Application ID: {application.id}
                </CardDescription>
              </div>
              <Badge className={getStatusColor(application.status)}>
                {application.status.replace("_", " ").toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Personal Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-600">First Name</Label>
                <p className="font-medium">
                  {application.first_name || "N/A"}
                </p>
              </div>
              <div>
                <Label className="text-gray-600">Last Name</Label>
                <p className="font-medium">
                  {application.last_name || "N/A"}
                </p>
              </div>
              <div>
                <Label className="text-gray-600">Phone</Label>
                <p className="font-medium">
                  {application.phone_e164 || "N/A"}
                </p>
              </div>
              <div>
                <Label className="text-gray-600">Age</Label>
                <p className="font-medium">{application.age ?? "N/A"}</p>
              </div>
              <div>
                <Label className="text-gray-600">Country of Residence</Label>
                <p className="font-medium">
                  {application.country_of_residence || "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Demographics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Demographics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label className="text-gray-600">Gender</Label>
                <p className="font-medium">{application.gender || "N/A"}</p>
              </div>
              <div>
                <Label className="text-gray-600">Race</Label>
                <p className="font-medium">{application.race || "N/A"}</p>
              </div>
              <div>
                <Label className="text-gray-600">Ethnicity</Label>
                <p className="font-medium">
                  {application.ethnicity || "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Education */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Education</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label className="text-gray-600">University</Label>
                <p className="font-medium">
                  {application.university || "N/A"}
                </p>
              </div>
              <div>
                <Label className="text-gray-600">Major</Label>
                <p className="font-medium">{application.major || "N/A"}</p>
              </div>
              <div>
                <Label className="text-gray-600">Level of Study</Label>
                <p className="font-medium">
                  {application.level_of_study || "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hackathon Experience */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Hackathon Experience</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label className="text-gray-600">Hackathons Attended</Label>
                <p className="font-medium">
                  {application.hackathons_attended_count ?? "N/A"}
                </p>
              </div>
              <div>
                <Label className="text-gray-600">
                  Software Experience Level
                </Label>
                <p className="font-medium">
                  {application.software_experience_level || "N/A"}
                </p>
              </div>
              <div>
                <Label className="text-gray-600">Heard About Us From</Label>
                <p className="font-medium">
                  {application.heard_about || "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Short Answer Questions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Short Answer Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {application.short_answer_questions?.length > 0 ? (
              [...application.short_answer_questions]
                .sort((a, b) => a.display_order - b.display_order)
                .map((q) => (
                  <div key={q.id}>
                    <Label className="text-gray-600">
                      {q.question} {q.required && "*"}
                    </Label>
                    <p className="mt-1 whitespace-pre-wrap">
                      {application.short_answer_responses?.[q.id] || "N/A"}
                    </p>
                  </div>
                ))
            ) : (
              <p className="text-gray-500">No questions configured.</p>
            )}
          </CardContent>
        </Card>

        {/* Event Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Event Preferences</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-600">Shirt Size</Label>
                <p className="font-medium">
                  {application.shirt_size || "N/A"}
                </p>
              </div>
              <div>
                <Label className="text-gray-600">Dietary Restrictions</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {application.dietary_restrictions?.length > 0 ? (
                    application.dietary_restrictions.map((restriction) => (
                      <Badge key={restriction} variant="secondary">
                        {restriction}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-gray-500">None</span>
                  )}
                </div>
              </div>
              <div className="md:col-span-2">
                <Label className="text-gray-600">Accommodations</Label>
                <p className="mt-1">
                  {application.accommodations || "None requested"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Links */}
        {(application.github ||
          application.linkedin ||
          application.website) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Links</CardTitle>
            </CardHeader>
            <CardContent>
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
                {application.website && (
                  <div>
                    <Label className="text-gray-600">Website</Label>
                    <p>
                      <a
                        href={application.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {application.website}
                      </a>
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Acknowledgments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Acknowledgments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <span
                  className={
                    application.ack_application
                      ? "text-green-600"
                      : "text-red-600"
                  }
                >
                  {application.ack_application ? "\u2713" : "\u2717"}
                </span>
                <span>Application Acknowledgment</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={
                    application.ack_mlh_coc
                      ? "text-green-600"
                      : "text-red-600"
                  }
                >
                  {application.ack_mlh_coc ? "\u2713" : "\u2717"}
                </span>
                <span>MLH Code of Conduct</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={
                    application.ack_mlh_privacy
                      ? "text-green-600"
                      : "text-red-600"
                  }
                >
                  {application.ack_mlh_privacy ? "\u2713" : "\u2717"}
                </span>
                <span>MLH Privacy Policy</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={
                    application.opt_in_mlh_emails
                      ? "text-green-600"
                      : "text-gray-400"
                  }
                >
                  {application.opt_in_mlh_emails ? "\u2713" : "\u2717"}
                </span>
                <span>MLH Email Opt-in</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label className="text-gray-600">Submitted At</Label>
                <p className="font-medium">
                  {formatDate(application.submitted_at)}
                </p>
              </div>
              <div>
                <Label className="text-gray-600">Created At</Label>
                <p className="font-medium">
                  {formatDate(application.created_at)}
                </p>
              </div>
              <div>
                <Label className="text-gray-600">Last Updated</Label>
                <p className="font-medium">
                  {formatDate(application.updated_at)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Update Status */}
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
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
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
  );
}
