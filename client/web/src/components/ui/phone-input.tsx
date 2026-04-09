import * as React from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/shared/lib/utils";

// Country codes list
const COUNTRY_CODES = [
  { code: "US", dialCode: "+1", name: "United States" },
  { code: "CA", dialCode: "+1", name: "Canada" },
  { code: "MX", dialCode: "+52", name: "Mexico" },
  { code: "GB", dialCode: "+44", name: "United Kingdom" },
  { code: "DE", dialCode: "+49", name: "Germany" },
  { code: "FR", dialCode: "+33", name: "France" },
  { code: "IN", dialCode: "+91", name: "India" },
  { code: "CN", dialCode: "+86", name: "China" },
  { code: "JP", dialCode: "+81", name: "Japan" },
  { code: "KR", dialCode: "+82", name: "South Korea" },
  { code: "AU", dialCode: "+61", name: "Australia" },
  { code: "BR", dialCode: "+55", name: "Brazil" },
  { code: "ES", dialCode: "+34", name: "Spain" },
  { code: "IT", dialCode: "+39", name: "Italy" },
  { code: "NL", dialCode: "+31", name: "Netherlands" },
  { code: "SE", dialCode: "+46", name: "Sweden" },
  { code: "CH", dialCode: "+41", name: "Switzerland" },
  { code: "SG", dialCode: "+65", name: "Singapore" },
  { code: "AE", dialCode: "+971", name: "UAE" },
  { code: "SA", dialCode: "+966", name: "Saudi Arabia" },
  { code: "NG", dialCode: "+234", name: "Nigeria" },
  { code: "ZA", dialCode: "+27", name: "South Africa" },
  { code: "PH", dialCode: "+63", name: "Philippines" },
  { code: "VN", dialCode: "+84", name: "Vietnam" },
  { code: "ID", dialCode: "+62", name: "Indonesia" },
  { code: "MY", dialCode: "+60", name: "Malaysia" },
  { code: "TH", dialCode: "+66", name: "Thailand" },
  { code: "PL", dialCode: "+48", name: "Poland" },
  { code: "TR", dialCode: "+90", name: "Turkey" },
  { code: "EG", dialCode: "+20", name: "Egypt" },
] as const;

// Format phone number for display (US format)
function formatPhoneDisplay(digits: string): string {
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

// Parse E.164 to extract country code and national number
function parseE164(e164: string): {
  countryCode: string;
  nationalNumber: string;
} {
  if (!e164 || !e164.startsWith("+")) {
    return { countryCode: "US", nationalNumber: "" };
  }

  // Sort by dial code length (longest first) to match correctly
  const sortedCodes = [...COUNTRY_CODES].sort(
    (a, b) => b.dialCode.length - a.dialCode.length,
  );

  for (const country of sortedCodes) {
    if (e164.startsWith(country.dialCode)) {
      return {
        countryCode: country.code,
        nationalNumber: e164.slice(country.dialCode.length),
      };
    }
  }

  return { countryCode: "US", nationalNumber: e164.slice(1) };
}

interface PhoneInputProps {
  value?: string;
  onChange?: (value: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function PhoneInput({
  value = "",
  onChange,
  placeholder = "(555) 123-4567",
  disabled,
  className,
}: PhoneInputProps) {
  // Parse the E.164 value
  const parsed = parseE164(value);
  const [countryCode, setCountryCode] = React.useState(parsed.countryCode);
  const [nationalNumber, setNationalNumber] = React.useState(
    parsed.nationalNumber,
  );

  // Get the dial code for selected country
  const selectedCountry =
    COUNTRY_CODES.find((c) => c.code === countryCode) || COUNTRY_CODES[0];

  // Sync when value prop changes externally
  React.useEffect(() => {
    const parsed = parseE164(value);
    setCountryCode(parsed.countryCode);
    setNationalNumber(parsed.nationalNumber);
  }, [value]);

  // Update the E.164 value when country or number changes
  const updateValue = (newCountryCode: string, newNationalNumber: string) => {
    const country =
      COUNTRY_CODES.find((c) => c.code === newCountryCode) || COUNTRY_CODES[0];
    const digits = newNationalNumber.replace(/\D/g, "");
    if (digits) {
      onChange?.(country.dialCode + digits);
    } else {
      onChange?.(undefined);
    }
  };

  const handleCountryChange = (newCode: string) => {
    setCountryCode(newCode);
    updateValue(newCode, nationalNumber);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 15);
    setNationalNumber(digits);
    updateValue(countryCode, digits);
  };

  return (
    <div className={cn("flex gap-2", className)}>
      {/* Country Code Dropdown */}
      <Select
        value={countryCode}
        onValueChange={handleCountryChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-[110px] shrink-0">
          <SelectValue>
            {selectedCountry.code} {selectedCountry.dialCode}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {COUNTRY_CODES.map((country) => (
            <SelectItem key={country.code} value={country.code}>
              {country.code} {country.dialCode}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Phone Number Input */}
      <Input
        type="tel"
        value={formatPhoneDisplay(nationalNumber)}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1"
      />
    </div>
  );
}

export { PhoneInput };
