import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getRequest, postRequest, errorAlert } from "../../lib/api";
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
import { Textarea } from "../../components/ui/textarea";

export default function Apply() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [application, setApplication] = useState<Application | null>(null);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    school: "",
    major: "",
    graduationYear: new Date().getFullYear(),
    shirtSize: "",
    dietaryRestrictions: "",
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
          firstName: res.data.firstName,
          lastName: res.data.lastName,
          email: res.data.email,
          school: res.data.school,
          major: res.data.major,
          graduationYear: res.data.graduationYear,
          shirtSize: res.data.shirtSize || "",
          dietaryRestrictions: res.data.dietaryRestrictions || "",
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

    const res = await postRequest<Application>(
      "/v1/applications",
      formData,
      "application"
    );

    if (res.status === 200 || res.status === 201) {
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
              ← Back to Dashboard
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
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) =>
                        setFormData({ ...formData, firstName: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) =>
                        setFormData({ ...formData, lastName: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="school">School *</Label>
                  <Input
                    id="school"
                    value={formData.school}
                    onChange={(e) =>
                      setFormData({ ...formData, school: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
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
                    <Label htmlFor="graduationYear">Graduation Year *</Label>
                    <Input
                      id="graduationYear"
                      type="number"
                      value={formData.graduationYear}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          graduationYear: parseInt(e.target.value),
                        })
                      }
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="shirtSize">Shirt Size</Label>
                  <Input
                    id="shirtSize"
                    value={formData.shirtSize}
                    onChange={(e) =>
                      setFormData({ ...formData, shirtSize: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="dietaryRestrictions">
                    Dietary Restrictions
                  </Label>
                  <Textarea
                    id="dietaryRestrictions"
                    value={formData.dietaryRestrictions}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        dietaryRestrictions: e.target.value,
                      })
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
                    ? "Submitting..."
                    : application
                    ? "Update Application"
                    : "Submit Application"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
