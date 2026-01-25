import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getRequest, patchRequest, errorAlert } from "../../lib/api";
import type { Application } from "../../types";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";

export default function Apply() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [application, setApplication] = useState<Application | null>(null);

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    university: "",
    major: "",
    shirt_size: "",
    github: "",
    linkedin: "",
  });

  useEffect(() => {
    const loadData = async () => {
      // Load existing application if available
      const res = await getRequest<Application>(
        "/v1/applications/me",
        "application"
      );
      if (res.status === 200 && res.data) {
        setApplication(res.data);
        setFormData({
          first_name: res.data.first_name || "",
          last_name: res.data.last_name || "",
          university: res.data.university || "",
          major: res.data.major || "",
          shirt_size: res.data.shirt_size || "",
          github: res.data.github || "",
          linkedin: res.data.linkedin || "",
        });
      }
      setLoading(false);
    };

    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const res = await patchRequest<Application>(
      "/v1/applications/me",
      formData,
      "application"
    );

    if (res.status === 200 && res.data) {
      setApplication(res.data);
      navigate("/app/status");
    } else {
      errorAlert(res);
    }

    setSubmitting(false);
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
              <CardTitle>Hacker Application</CardTitle>
              <CardDescription>
                {application
                  ? "Update your application"
                  : "Complete your application to participate in HackUTD"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="first_name">First Name *</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) =>
                        setFormData({ ...formData, first_name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="last_name">Last Name *</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) =>
                        setFormData({ ...formData, last_name: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="university">University *</Label>
                  <Input
                    id="university"
                    value={formData.university}
                    onChange={(e) =>
                      setFormData({ ...formData, university: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="major">Major *</Label>
                  <Input
                    id="major"
                    value={formData.major}
                    onChange={(e) =>
                      setFormData({ ...formData, major: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="shirt_size">Shirt Size</Label>
                  <Input
                    id="shirt_size"
                    value={formData.shirt_size}
                    onChange={(e) =>
                      setFormData({ ...formData, shirt_size: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="github">GitHub</Label>
                  <Input
                    id="github"
                    value={formData.github}
                    onChange={(e) =>
                      setFormData({ ...formData, github: e.target.value })
                    }
                    placeholder="https://github.com/username"
                  />
                </div>

                <div>
                  <Label htmlFor="linkedin">LinkedIn</Label>
                  <Input
                    id="linkedin"
                    value={formData.linkedin}
                    onChange={(e) =>
                      setFormData({ ...formData, linkedin: e.target.value })
                    }
                    placeholder="https://linkedin.com/in/username"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting
                    ? "Saving..."
                    : application
                      ? "Update Application"
                      : "Save Application"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
