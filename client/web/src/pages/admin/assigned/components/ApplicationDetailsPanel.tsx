import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import type { Application } from "@/types";

import type { Review } from "../types";

interface ApplicationDetailsPanelProps {
  application: Application;
  selectedReview: Review;
  isExpanded: boolean;
}

export function ApplicationDetailsPanel({
  application,
  selectedReview,
  isExpanded,
}: ApplicationDetailsPanelProps) {
  const gridCols = isExpanded ? "grid-cols-4" : "grid-cols-2";

  return (
    <div className="space-y-6 pb-2">
      {/* Personal Info */}
      <div>
        <h4 className="text-sm font-semibold mb-2">Personal Information</h4>
        <div className={`grid ${gridCols} gap-3 text-sm`}>
          <div>
            <Label className="text-muted-foreground text-xs">Phone</Label>
            <p>{application.phone_e164 || "N/A"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Age</Label>
            <p>{application.age ?? "N/A"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Country</Label>
            <p>{application.country_of_residence || "N/A"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Gender</Label>
            <p>{application.gender || "N/A"}</p>
          </div>
        </div>
      </div>

      {/* Demographics */}
      <div>
        <h4 className="text-sm font-semibold mb-2">Demographics</h4>
        <div className={`grid ${gridCols} gap-3 text-sm`}>
          <div>
            <Label className="text-muted-foreground text-xs">Race</Label>
            <p>{application.race || "N/A"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Ethnicity</Label>
            <p>{application.ethnicity || "N/A"}</p>
          </div>
        </div>
      </div>

      {/* Education */}
      <div>
        <h4 className="text-sm font-semibold mb-2">Education</h4>
        <div className={`grid ${gridCols} gap-3 text-sm`}>
          <div className={isExpanded ? "" : "col-span-2"}>
            <Label className="text-muted-foreground text-xs">University</Label>
            <p>{application.university || "N/A"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Major</Label>
            <p>{application.major || "N/A"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">
              Level of Study
            </Label>
            <p>{application.level_of_study || "N/A"}</p>
          </div>
        </div>
      </div>

      {/* Experience */}
      <div>
        <h4 className="text-sm font-semibold mb-2">Experience</h4>
        <div className={`grid ${gridCols} gap-3 text-sm`}>
          <div>
            <Label className="text-muted-foreground text-xs">
              Hackathons Attended
            </Label>
            <p>{application.hackathons_attended_count ?? "N/A"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">
              Software Experience
            </Label>
            <p>{application.software_experience_level || "N/A"}</p>
          </div>
          <div className={isExpanded ? "" : "col-span-2"}>
            <Label className="text-muted-foreground text-xs">
              Heard About Us From
            </Label>
            <p>{application.heard_about || "N/A"}</p>
          </div>
        </div>
      </div>

      {/* Short Answers */}
      {application.short_answer_questions?.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2">Short Answers</h4>
          <div className="space-y-3 text-sm">
            {[...application.short_answer_questions]
              .sort((a, b) => a.display_order - b.display_order)
              .map((q) => (
                <div key={q.id}>
                  <Label className="text-muted-foreground text-xs">
                    {q.question} {q.required && "*"}
                  </Label>
                  <p className="whitespace-pre-wrap">
                    {application.short_answer_responses?.[q.id] || "N/A"}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Event Preferences */}
      <div>
        <h4 className="text-sm font-semibold mb-2">Event Preferences</h4>
        <div className={`grid ${gridCols} gap-3 text-sm`}>
          <div>
            <Label className="text-muted-foreground text-xs">Shirt Size</Label>
            <p>{application.shirt_size || "N/A"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">
              Dietary Restrictions
            </Label>
            <div className="flex flex-wrap gap-1">
              {application.dietary_restrictions?.length > 0 ? (
                application.dietary_restrictions.map((restriction) => (
                  <Badge
                    key={restriction}
                    variant="secondary"
                    className="text-xs"
                  >
                    {restriction}
                  </Badge>
                ))
              ) : (
                <span>None</span>
              )}
            </div>
          </div>
          {application.accommodations && (
            <div className={isExpanded ? "" : "col-span-2"}>
              <Label className="text-muted-foreground text-xs">
                Accommodations
              </Label>
              <p>{application.accommodations}</p>
            </div>
          )}
        </div>
      </div>

      {/* Links */}
      {(application.github || application.linkedin || application.website) && (
        <div>
          <h4 className="text-sm font-semibold mb-2">Links</h4>
          <div
            className={`grid ${isExpanded ? "grid-cols-3" : "grid-cols-1"} gap-2 text-sm`}
          >
            {application.github && (
              <div>
                <Label className="text-muted-foreground text-xs">GitHub</Label>
                <p>
                  <a
                    href={application.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline break-all"
                  >
                    {application.github}
                  </a>
                </p>
              </div>
            )}
            {application.linkedin && (
              <div>
                <Label className="text-muted-foreground text-xs">
                  LinkedIn
                </Label>
                <p>
                  <a
                    href={application.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline break-all"
                  >
                    {application.linkedin}
                  </a>
                </p>
              </div>
            )}
            {application.website && (
              <div>
                <Label className="text-muted-foreground text-xs">Website</Label>
                <p>
                  <a
                    href={application.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline break-all"
                  >
                    {application.website}
                  </a>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div>
        <h4 className="text-sm font-semibold mb-2">Timeline</h4>
        <div className={`grid ${gridCols} gap-3 text-sm`}>
          <div>
            <Label className="text-muted-foreground text-xs">Submitted</Label>
            <p>
              {application.submitted_at
                ? new Date(application.submitted_at).toLocaleString()
                : "N/A"}
            </p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Created</Label>
            <p>{new Date(application.created_at).toLocaleString()}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">
              Last Updated
            </Label>
            <p>{new Date(application.updated_at).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Review Info */}
      <div>
        <h4 className="text-sm font-semibold mb-2">Review Details</h4>
        <div className={`grid ${gridCols} gap-3 text-sm`}>
          <div className={isExpanded ? "" : "col-span-2"}>
            <Label className="text-muted-foreground text-xs">
              Application ID
            </Label>
            <p className="font-mono text-xs">{selectedReview.application_id}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Assigned At</Label>
            <p>{new Date(selectedReview.assigned_at).toLocaleString()}</p>
          </div>
          {selectedReview.reviewed_at && (
            <div>
              <Label className="text-muted-foreground text-xs">
                Reviewed At
              </Label>
              <p>{new Date(selectedReview.reviewed_at).toLocaleString()}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
