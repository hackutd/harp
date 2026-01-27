import { Users, Clock, Check, Percent } from "lucide-react"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { ApplicationStats } from "@/types"

interface SectionCardsProps {
  stats: ApplicationStats | null;
  loading?: boolean;
}

export function SectionCards({ stats, loading }: SectionCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="@container/card animate-pulse">
            <CardHeader>
              <div className="h-4 w-24 bg-gray-200 rounded" />
              <div className="h-8 w-16 bg-gray-200 rounded mt-2" />
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Total Applications",
      value: stats?.total_applications ?? 0,
      icon: Users,
      description: "All applications received",
    },
    {
      title: "Pending Review",
      value: stats?.submitted ?? 0,
      icon: Clock,
      description: "Awaiting decision",
    },
    {
      title: "Accepted",
      value: stats?.accepted ?? 0,
      icon: Check,
      description: "Applications accepted",
    },
    {
      title: "Acceptance Rate",
      value: `${(stats?.acceptance_rate ?? 0).toFixed(1)}%`,
      icon: Percent,
      description: "Of reviewed applications",
    },
  ];

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-4 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs">
      {cards.map((card) => (
        <Card key={card.title} className="@container/card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardDescription>{card.title}</CardDescription>
              <card.icon className="size-5 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {card.value}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{card.description}</p>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
