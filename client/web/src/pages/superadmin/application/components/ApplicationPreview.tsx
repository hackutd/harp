import { useEffect, useRef } from "react";

import type { ShortAnswerQuestion } from "@/types";

interface ApplicationPreviewProps {
  questions: ShortAnswerQuestion[];
}

function PreviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">{title}</h3>
        <div className="h-px bg-gray-200" />
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function PreviewField({
  label,
  placeholder,
  required,
}: {
  label: string;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-700">
        {label}
        {required && <span className="text-gray-400 ml-1">*</span>}
      </label>
      <div className="h-9 rounded-md border border-gray-200 bg-gray-50 px-3 flex items-center">
        <span className="text-xs text-gray-400">{placeholder}</span>
      </div>
    </div>
  );
}

function PreviewTextarea({
  label,
  placeholder,
  required,
}: {
  label: string;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-700">
        {label}
        {required && <span className="text-gray-400 ml-1">*</span>}
      </label>
      <div className="min-h-[80px] rounded-md border border-gray-200 bg-gray-50 px-3 py-2 flex items-start">
        <span className="text-xs text-gray-400">{placeholder}</span>
      </div>
    </div>
  );
}

function PreviewCheckbox({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="size-4 rounded border border-gray-300 bg-white shrink-0" />
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}

const DIETARY_OPTIONS = [
  "Vegan",
  "Vegetarian",
  "Halal",
  "Nut Allergy",
  "Fish Allergy",
  "Wheat/Gluten",
  "Dairy",
  "Eggs",
  "No Beef",
  "No Pork",
];

export function ApplicationPreview({ questions }: ApplicationPreviewProps) {
  const shortAnswersRef = useRef<HTMLDivElement>(null);
  const hasScrolled = useRef(false);

  useEffect(() => {
    if (
      questions.length > 0 &&
      !hasScrolled.current &&
      shortAnswersRef.current
    ) {
      shortAnswersRef.current.scrollIntoView({ behavior: "smooth" });
      hasScrolled.current = true;
    }
  }, [questions]);

  const sortedQuestions = [...questions].sort(
    (a, b) => a.display_order - b.display_order,
  );

  return (
    <div className="p-6 space-y-8">
      {/* Step pills */}
      <div className="flex gap-1.5 flex-wrap">
        {[
          "Personal Info",
          "School",
          "Experience",
          "Short Answers",
          "Event",
          "Sponsor",
          "Agreements",
        ].map((label) => (
          <span
            key={label}
            className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500"
          >
            {label}
          </span>
        ))}
      </div>

      {/* 1. Personal Info */}
      <PreviewSection title="Personal Information">
        <div className="grid grid-cols-2 gap-3">
          <PreviewField label="First Name" placeholder="John" required />
          <PreviewField label="Last Name" placeholder="Doe" required />
        </div>
        <PreviewField
          label="Email"
          placeholder="From your account — read only"
        />
        <PreviewField
          label="Phone Number"
          placeholder="+1 (202) 555-1234"
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <PreviewField label="Age" placeholder="18" required />
          <PreviewField
            label="Country of Residence"
            placeholder="Select..."
            required
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <PreviewField label="Gender" placeholder="Select..." required />
          <PreviewField label="Race" placeholder="Select..." required />
          <PreviewField label="Ethnicity" placeholder="Select..." required />
        </div>
      </PreviewSection>

      {/* 2. School Info */}
      <PreviewSection title="School Information">
        <PreviewField
          label="University"
          placeholder="University of Texas at Dallas"
          required
        />
        <PreviewField label="Major" placeholder="Computer Science" required />
        <PreviewField label="Level of Study" placeholder="Select..." required />
      </PreviewSection>

      {/* 3. Experience */}
      <PreviewSection title="Hackathon Experience">
        <PreviewField label="Hackathons Attended" placeholder="0" required />
        <PreviewField
          label="Software Experience Level"
          placeholder="Select..."
          required
        />
        <PreviewField
          label="How did you hear about us?"
          placeholder="Select..."
          required
        />
      </PreviewSection>

      {/* 4. Short Answers — live from props */}
      <div ref={shortAnswersRef} />
      <PreviewSection title="Short Answer Questions">
        {sortedQuestions.length === 0 ? (
          <p className="text-xs text-gray-400 italic">
            No questions configured yet.
          </p>
        ) : (
          sortedQuestions.map((q, i) => (
            <PreviewTextarea
              key={q.id}
              label={q.question || `Question ${i + 1}`}
              placeholder="Your answer..."
              required={q.required}
            />
          ))
        )}
      </PreviewSection>

      {/* 5. Event Info */}
      <PreviewSection title="Event Information">
        <PreviewField label="Shirt Size" placeholder="Select..." required />
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-700">
            Dietary Restrictions
            <span className="text-gray-400 ml-1 font-normal">
              — select all that apply
            </span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {DIETARY_OPTIONS.map((label) => (
              <PreviewCheckbox key={label} label={label} />
            ))}
          </div>
        </div>
        <PreviewTextarea
          label="Accommodations"
          placeholder="List any accessibility needs..."
        />
      </PreviewSection>

      {/* 6. Sponsor Info */}
      <PreviewSection title="Sponsor Information">
        <PreviewField
          label="GitHub"
          placeholder="https://github.com/username"
        />
        <PreviewField
          label="LinkedIn"
          placeholder="https://linkedin.com/in/username"
        />
        <PreviewField
          label="Personal Website"
          placeholder="https://yourwebsite.com"
        />
      </PreviewSection>

      {/* 7. Agreements */}
      <PreviewSection title="Agreements">
        <div className="space-y-3">
          <PreviewCheckbox label="I understand that this is an application and does not guarantee admission. *" />
          <PreviewCheckbox label="I have read and agree to the MLH Code of Conduct. *" />
          <PreviewCheckbox label="I authorize sharing my information with MLH per their Privacy Policy. *" />
          <PreviewCheckbox label="I authorize MLH to send me occasional emails about events and opportunities." />
        </div>
      </PreviewSection>
    </div>
  );
}
