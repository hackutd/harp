import {
  BellRing,
  LayoutGrid,
  Search,
  Sparkles,
  TriangleAlert,
  Users,
} from "lucide-react";
import { useDeferredValue, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertTitle,
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Calendar,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RadioGroup,
  RadioGroupItem,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";

type SectionId = "feedback" | "forms" | "overlays" | "data";

type ShowcaseFormValues = {
  applicantName: string;
  track: string;
  notes: string;
};

type ComponentMeta = {
  name: string;
  section: SectionId;
  usageCount: number;
};

const SECTION_TITLES: Record<SectionId, string> = {
  feedback: "Feedback & Status",
  forms: "Forms & Selection",
  overlays: "Overlays & Actions",
  data: "Data & Navigation",
};

const COMPONENT_INVENTORY: ComponentMeta[] = [
  { name: "Alert", section: "feedback", usageCount: 4 },
  { name: "Badge", section: "feedback", usageCount: 19 },
  { name: "Skeleton", section: "feedback", usageCount: 12 },
  { name: "Sonner", section: "feedback", usageCount: 1 },
  { name: "Button", section: "forms", usageCount: 42 },
  { name: "Calendar", section: "forms", usageCount: 1 },
  { name: "Checkbox", section: "forms", usageCount: 2 },
  { name: "Form", section: "forms", usageCount: 1 },
  { name: "Input", section: "forms", usageCount: 18 },
  { name: "Label", section: "forms", usageCount: 19 },
  { name: "Radio Group", section: "forms", usageCount: 1 },
  { name: "Select", section: "forms", usageCount: 5 },
  { name: "Switch", section: "forms", usageCount: 6 },
  { name: "Textarea", section: "forms", usageCount: 4 },
  { name: "Accordion", section: "overlays", usageCount: 1 },
  { name: "Alert Dialog", section: "overlays", usageCount: 6 },
  { name: "Collapsible", section: "overlays", usageCount: 1 },
  { name: "Dialog", section: "overlays", usageCount: 6 },
  { name: "Dropdown Menu", section: "overlays", usageCount: 1 },
  { name: "Popover", section: "overlays", usageCount: 5 },
  { name: "Tooltip", section: "overlays", usageCount: 5 },
  { name: "Avatar", section: "data", usageCount: 2 },
  { name: "Card", section: "data", usageCount: 23 },
  { name: "Scroll Area", section: "data", usageCount: 1 },
  { name: "Separator", section: "data", usageCount: 1 },
  { name: "Sidebar", section: "data", usageCount: 4 },
  { name: "Table", section: "data", usageCount: 6 },
  { name: "Tabs", section: "data", usageCount: 3 },
];

function SectionBadges({ section }: { section: SectionId }) {
  return (
    <div className="flex flex-wrap gap-2">
      {COMPONENT_INVENTORY.filter((item) => item.section === section).map(
        (item) => (
          <Badge key={item.name} variant="secondary" className="gap-1.5">
            <span>{item.name}</span>
            <span className="text-muted-foreground">{item.usageCount}</span>
          </Badge>
        ),
      )}
    </div>
  );
}

export default function UiShowcasePage() {
  const showcaseForm = useForm<ShowcaseFormValues>({
    defaultValues: {
      applicantName: "Taylor Chen",
      track: "design",
      notes: "Audit spacing, states, and typography before the next visual pass.",
    },
  });

  const [inventoryQuery, setInventoryQuery] = useState("");
  const deferredQuery = useDeferredValue(inventoryQuery.trim().toLowerCase());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date(2026, 3, 16),
  );
  const [swagOptIn, setSwagOptIn] = useState(true);
  const [priorityMode, setPriorityMode] = useState(true);
  const [contactPreference, setContactPreference] = useState("email");
  const [menuLabelsEnabled, setMenuLabelsEnabled] = useState(true);
  const [menuDensity, setMenuDensity] = useState("comfortable");

  const visibleComponents = COMPONENT_INVENTORY.filter((item) => {
    if (!deferredQuery) {
      return true;
    }

    return (
      item.name.toLowerCase().includes(deferredQuery) ||
      SECTION_TITLES[item.section].toLowerCase().includes(deferredQuery)
    );
  });

  const totalImports = COMPONENT_INVENTORY.reduce(
    (count, item) => count + item.usageCount,
    0,
  );
  const mostUsedComponent = COMPONENT_INVENTORY.reduce((current, candidate) =>
    candidate.usageCount > current.usageCount ? candidate : current,
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-auto pr-1">
      <Card className="py-0">
        <CardHeader className="border-b py-6">
          <div className="space-y-2">
            <Badge variant="outline" className="w-fit">
              /admin/ui-showcase
            </Badge>
            <CardTitle className="text-2xl">UI Showcase</CardTitle>
            <CardDescription className="max-w-3xl">
              A single admin route that renders every UI primitive currently
              imported in the frontend, so you can review and restyle the
              system from one place.
            </CardDescription>
          </div>
          <CardAction className="w-full pt-4 md:w-80 md:pt-0">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={inventoryQuery}
                onChange={(event) => setInventoryQuery(event.target.value)}
                placeholder="Filter components or sections"
                className="pl-9"
              />
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-6 py-6">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="text-muted-foreground text-sm">Primitives in use</p>
              <p className="mt-1 text-3xl font-semibold">
                {COMPONENT_INVENTORY.length}
              </p>
            </div>
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="text-muted-foreground text-sm">Import references</p>
              <p className="mt-1 text-3xl font-semibold">{totalImports}</p>
            </div>
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="text-muted-foreground text-sm">Most used</p>
              <p className="mt-1 text-3xl font-semibold">
                {mostUsedComponent.name}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {mostUsedComponent.usageCount} frontend imports
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {visibleComponents.map((item) => (
              <Button
                key={item.name}
                asChild
                variant="outline"
                size="sm"
                className="gap-3"
              >
                <a href={`#${item.section}`}>
                  <span>{item.name}</span>
                  <Badge variant="secondary">{item.usageCount}</Badge>
                </a>
              </Button>
            ))}
          </div>

          {!visibleComponents.length && (
            <Alert>
              <Search className="size-4" />
              <AlertTitle>No matching components</AlertTitle>
              <AlertDescription>
                Clear the filter to see the full inventory again.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card id="feedback" className="scroll-mt-4">
          <CardHeader>
            <CardTitle>Feedback & Status</CardTitle>
            <CardDescription>
              Status chips, alerts, loading states, and toast notifications.
            </CardDescription>
            <SectionBadges section="feedback" />
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="flex flex-wrap gap-2">
              <Badge>Accepted</Badge>
              <Badge variant="secondary">Pending Review</Badge>
              <Badge variant="outline">Draft</Badge>
              <Badge variant="destructive">Blocked</Badge>
            </div>

            <div className="grid gap-3">
              <Alert>
                <BellRing className="size-4" />
                <AlertTitle>Default alert</AlertTitle>
                <AlertDescription>
                  Use this for non-blocking system notices and inline callouts.
                </AlertDescription>
              </Alert>

              <Alert variant="destructive">
                <TriangleAlert className="size-4" />
                <AlertTitle>Destructive alert</AlertTitle>
                <AlertDescription>
                  Reserve this state for errors or actions with real risk.
                </AlertDescription>
              </Alert>
            </div>

            <div className="rounded-md border p-4">
              <p className="mb-4 text-sm font-medium">Skeleton loading state</p>
              <div className="flex items-start gap-3">
                <Skeleton className="size-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            </div>

            <div className="rounded-md border p-4">
              <p className="mb-3 text-sm font-medium">Sonner preview</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    toast.success("Saved component inventory snapshot.")
                  }
                >
                  Success toast
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    toast.warning("Design review is still using placeholder data.")
                  }
                >
                  Warning toast
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    toast.error("The destructive state needs stronger contrast.")
                  }
                >
                  Error toast
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card id="forms" className="scroll-mt-4">
          <CardHeader>
            <CardTitle>Forms & Selection</CardTitle>
            <CardDescription>
              Field wrappers, text inputs, toggles, choice controls, and date
              selection.
            </CardDescription>
            <SectionBadges section="forms" />
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-md border p-4">
              <p className="mb-4 text-sm font-medium">Form composition</p>
              <Form {...showcaseForm}>
                <form
                  onSubmit={showcaseForm.handleSubmit(() =>
                    toast.success("Showcase form submitted."),
                  )}
                  className="grid gap-4"
                >
                  <FormField
                    control={showcaseForm.control}
                    name="applicantName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Applicant Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormDescription>
                          A standard text input inside the shared form wrapper.
                        </FormDescription>
                        <FormMessage>Looks ready for a visual pass.</FormMessage>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={showcaseForm.control}
                    name="track"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Track</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Choose a track" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="design">Design</SelectItem>
                            <SelectItem value="frontend">Frontend</SelectItem>
                            <SelectItem value="operations">Operations</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Select states and menus should stay consistent with the
                          text field surface.
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={showcaseForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea rows={4} {...field} />
                        </FormControl>
                        <FormDescription>
                          Textarea height, spacing, and tone can all be tuned
                          here.
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <div className="flex flex-wrap gap-2">
                    <Button type="submit">Save Preview</Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => showcaseForm.reset()}
                    >
                      Reset
                    </Button>
                  </div>
                </form>
              </Form>
            </div>

            <div className="grid gap-4">
              <div className="rounded-md border p-4">
                <p className="mb-4 text-sm font-medium">Choice controls</p>
                <div className="grid gap-4">
                  <div className="flex items-center justify-between gap-4">
                    <Label htmlFor="showcase-checkbox">
                      Swag package included
                    </Label>
                    <Checkbox
                      id="showcase-checkbox"
                      checked={swagOptIn}
                      onCheckedChange={(checked) =>
                        setSwagOptIn(checked === true)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <Label htmlFor="showcase-switch">Priority mode</Label>
                    <Switch
                      id="showcase-switch"
                      checked={priorityMode}
                      onCheckedChange={setPriorityMode}
                    />
                  </div>

                  <div className="grid gap-3">
                    <Label>Contact preference</Label>
                    <RadioGroup
                      value={contactPreference}
                      onValueChange={setContactPreference}
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem
                          id="showcase-contact-email"
                          value="email"
                        />
                        <Label htmlFor="showcase-contact-email">Email</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem
                          id="showcase-contact-slack"
                          value="slack"
                        />
                        <Label htmlFor="showcase-contact-slack">Slack</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              </div>

              <div className="rounded-md border p-4">
                <p className="mb-4 text-sm font-medium">Calendar</p>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="rounded-md border"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card id="overlays" className="scroll-mt-4">
          <CardHeader>
            <CardTitle>Overlays & Actions</CardTitle>
            <CardDescription>
              Modals, menus, flyouts, tooltips, and disclosure patterns.
            </CardDescription>
            <SectionBadges section="overlays" />
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="flex flex-wrap gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button>Open dialog</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Dialog preview</DialogTitle>
                    <DialogDescription>
                      Review modal spacing, width, and the close affordance here.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="dialog-name">Name</Label>
                      <Input id="dialog-name" defaultValue="Spring Visual Audit" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="dialog-notes">Summary</Label>
                      <Textarea
                        id="dialog-notes"
                        rows={3}
                        defaultValue="Tighten borders, states, and internal card spacing."
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline">Cancel</Button>
                    <Button>Save changes</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline">Open alert dialog</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm destructive state</AlertDialogTitle>
                    <AlertDialogDescription>
                      This pattern should feel heavier than a standard dialog
                      because it interrupts the flow.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction>Delete draft</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="secondary">Open popover</Button>
                </PopoverTrigger>
                <PopoverContent className="grid gap-3">
                  <div>
                    <p className="font-medium">Popover preview</p>
                    <p className="text-muted-foreground text-sm">
                      Good for lightweight settings and contextual actions.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">Compact</Badge>
                    <Badge variant="outline">Inline filters</Badge>
                  </div>
                  <Button size="sm" className="w-full">
                    Apply
                  </Button>
                </PopoverContent>
              </Popover>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">Open menu</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Sidebar controls</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={menuLabelsEnabled}
                    onCheckedChange={(checked) =>
                      setMenuLabelsEnabled(checked === true)
                    }
                  >
                    Show labels
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup
                    value={menuDensity}
                    onValueChange={setMenuDensity}
                  >
                    <DropdownMenuRadioItem value="comfortable">
                      Comfortable
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="compact">
                      Compact
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => toast.success("Menu action previewed.")}
                  >
                    Apply preview
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Tooltip preview">
                    <Sparkles className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Tooltip preview</TooltipContent>
              </Tooltip>
            </div>

            <Separator />

            <Collapsible defaultOpen className="rounded-md border">
              <div className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-medium">Collapsible panel</p>
                  <p className="text-muted-foreground text-sm">
                    Useful for optional detail that should stay nearby.
                  </p>
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    Toggle
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className="border-t px-4 py-3 text-sm">
                Disclosure patterns should open cleanly without shifting nearby
                controls too aggressively.
              </CollapsibleContent>
            </Collapsible>

            <Accordion type="single" collapsible className="rounded-md border px-4">
              <AccordionItem value="spacing">
                <AccordionTrigger>Spacing</AccordionTrigger>
                <AccordionContent>
                  Use this item to tune internal spacing and divider rhythm.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="motion">
                <AccordionTrigger>Motion</AccordionTrigger>
                <AccordionContent>
                  This item gives you a quick read on the disclosure animation
                  and trigger affordance.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        <Card id="data" className="scroll-mt-4">
          <CardHeader>
            <CardTitle>Data & Navigation</CardTitle>
            <CardDescription>
              High-density surfaces, layout primitives, and navigation patterns.
            </CardDescription>
            <SectionBadges section="data" />
          </CardHeader>
          <CardContent className="grid gap-6">
            <Tabs defaultValue="surfaces">
              <TabsList>
                <TabsTrigger value="surfaces">Surfaces</TabsTrigger>
                <TabsTrigger value="navigation">Navigation</TabsTrigger>
                <TabsTrigger value="density">Density</TabsTrigger>
              </TabsList>
              <TabsContent value="surfaces" className="text-muted-foreground text-sm">
                Cards, avatars, and tables should feel cohesive across the admin
                shell.
              </TabsContent>
              <TabsContent
                value="navigation"
                className="text-muted-foreground text-sm"
              >
                Tabs and sidebars should read as related but not visually identical.
              </TabsContent>
              <TabsContent value="density" className="text-muted-foreground text-sm">
                Use the denser surfaces below to tune hierarchy, not just borders.
              </TabsContent>
            </Tabs>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Track</TableHead>
                    <TableHead>Owner</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Taylor Chen</TableCell>
                    <TableCell>
                      <Badge variant="secondary">In Review</Badge>
                    </TableCell>
                    <TableCell>Design</TableCell>
                    <TableCell>Team Portal</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Jordan Patel</TableCell>
                    <TableCell>
                      <Badge>Accepted</Badge>
                    </TableCell>
                    <TableCell>Frontend</TableCell>
                    <TableCell>Admissions</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Casey Nguyen</TableCell>
                    <TableCell>
                      <Badge variant="outline">Draft</Badge>
                    </TableCell>
                    <TableCell>Operations</TableCell>
                    <TableCell>Super Admin</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center gap-3">
              <Avatar className="size-10">
                <AvatarFallback>TC</AvatarFallback>
              </Avatar>
              <Avatar className="size-10">
                <AvatarFallback>JP</AvatarFallback>
              </Avatar>
              <Avatar className="size-10">
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
            </div>

            <Separator />

            <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
              <div className="overflow-hidden rounded-md border">
                <SidebarProvider className="min-h-[19rem]">
                  <Sidebar collapsible="none" className="h-full border-0">
                    <SidebarHeader>
                      <div className="px-2 py-1">
                        <p className="text-sm font-semibold">Admin Shell</p>
                        <p className="text-sidebar-foreground/70 text-xs">
                          Sidebar primitives in a compact preview
                        </p>
                      </div>
                      <SidebarInput placeholder="Search routes" />
                    </SidebarHeader>
                    <SidebarSeparator />
                    <SidebarContent>
                      <SidebarGroup>
                        <SidebarGroupLabel>Design</SidebarGroupLabel>
                        <SidebarGroupContent>
                          <SidebarMenu>
                            <SidebarMenuItem>
                              <SidebarMenuButton isActive>
                                <LayoutGrid />
                                <span>UI Showcase</span>
                              </SidebarMenuButton>
                              <SidebarMenuBadge>28</SidebarMenuBadge>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                              <SidebarMenuButton>
                                <Users />
                                <span>User Management</span>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          </SidebarMenu>
                        </SidebarGroupContent>
                      </SidebarGroup>
                    </SidebarContent>
                    <SidebarFooter>
                      <SidebarMenu>
                        <SidebarMenuItem>
                          <SidebarMenuButton>
                            <Sparkles />
                            <span>Theme Review</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      </SidebarMenu>
                    </SidebarFooter>
                  </Sidebar>
                </SidebarProvider>
              </div>

              <ScrollArea className="h-[19rem] rounded-md border">
                <div className="space-y-3 p-4">
                  {[
                    "Review hover and focus states across all button variants.",
                    "Check badge contrast against muted and table backgrounds.",
                    "Compare modal padding with card padding for consistency.",
                    "Decide whether sidebar labels need stronger hierarchy.",
                    "Tune dense table rows before changing global type scale.",
                    "Revisit skeleton radius so loading and loaded states align.",
                    "Audit toast spacing once the new color tokens land.",
                  ].map((item) => (
                    <div key={item} className="rounded-md border p-3 text-sm">
                      {item}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
