import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

export default function ApplicationsTab() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg text-zinc-100">Applications</h3>
      <p className="text-sm text-zinc-400">
        Manage applications, and enable or disable them.
      </p>

      <div className="bg-zinc-900 rounded-md p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="applications-toggle" className="text-sm font-medium text-zinc-100 cursor-pointer">
              Application Submissions
            </Label>
            <p className="text-xs text-zinc-500">
              When enabled, hackers can submit their applications.
            </p>
          </div>
          <Switch className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500" id="applications-toggle" />
        </div>
      </div>


    </div>
  )
}
