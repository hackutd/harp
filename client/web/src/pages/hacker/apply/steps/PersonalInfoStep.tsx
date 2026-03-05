import { useFormContext } from "react-hook-form";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { SelectWithOther } from "../components/SelectWithOther";
import type { ApplicationFormData } from "../validations";
import {
  COUNTRY_OPTIONS,
  ETHNICITY_OPTIONS,
  GENDER_OPTIONS,
  RACE_OPTIONS,
} from "../validations";

interface PersonalInfoStepProps {
  userEmail?: string;
}

export function PersonalInfoStep({ userEmail }: PersonalInfoStepProps) {
  const form = useFormContext<ApplicationFormData>();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Personal Information</h2>
        <p className="text-sm text-muted-foreground">
          Tell us a bit about yourself
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="first_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>First Name *</FormLabel>
              <FormControl>
                <Input placeholder="John" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="last_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Last Name *</FormLabel>
              <FormControl>
                <Input placeholder="Doe" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Read-only email from user profile */}
      {userEmail && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Email</label>
          <Input value={userEmail} disabled className="bg-muted" />
          <p className="text-xs text-muted-foreground">
            Email is from your account and cannot be changed here
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="phone_e164"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number *</FormLabel>
              <FormControl>
                <PhoneInput
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="(123) 456-7890"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="age"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Age *</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  max={150}
                  placeholder="18"
                  {...field}
                  onChange={(e) => field.onChange(e.target.valueAsNumber || "")}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="country_of_residence"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Country of Residence *</FormLabel>
            <FormControl>
              <SelectWithOther
                options={COUNTRY_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                placeholder="Select your country"
                otherPlaceholder="Enter your country"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      
      <FormField
        control={form.control}
        name="gender"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Gender *</FormLabel>
            <FormControl>
              <SelectWithOther
                options={GENDER_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                placeholder="Select your gender"
                otherPlaceholder="Please specify your gender"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />


      <FormField
        control={form.control}
        name="race"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Race *</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select your race" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {RACE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="ethnicity"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Ethnicity *</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select your ethnicity" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {ETHNICITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
