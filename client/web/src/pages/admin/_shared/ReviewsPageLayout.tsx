import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Link, useLocation } from "react-router-dom";

interface ReviewsPageLayoutProps {
  isExpanded?: boolean;
  headerDescription: ReactNode;
  headerActions?: ReactNode;
  table: ReactNode;
  detailPanel?: ReactNode;
}

export function ReviewsPageLayout({
  isExpanded = false,
  headerDescription,
  headerActions,
  table,
  detailPanel,
}: ReviewsPageLayoutProps) {
  const location = useLocation();
  const isAssigned = location.pathname === "/admin/assigned";

  return (
    <div className="h-[calc(100vh-80px)] overflow-hidden">
      <div className="flex h-full">
        {!isExpanded && (
          <Card
            className={`overflow-hidden flex flex-col h-full ${
              detailPanel ? "w-1/2 rounded-r-none" : "w-full"
            }`}
          >
            <CardHeader className="shrink-0 flex flex-row items-center justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex gap-1">
                  <Badge asChild variant={isAssigned ? "default" : "outline"}>
                    <Link to="/admin/assigned">Assigned</Link>
                  </Badge>
                  <Badge asChild variant={!isAssigned ? "default" : "outline"}>
                    <Link to="/admin/completed">Completed</Link>
                  </Badge>
                </div>
                <CardDescription className="font-light">
                  {headerDescription}
                </CardDescription>
              </div>
              {headerActions}
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              {table}
            </CardContent>
          </Card>
        )}

        {detailPanel}
      </div>
    </div>
  );
}
