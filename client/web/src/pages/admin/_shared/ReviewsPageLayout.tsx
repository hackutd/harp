import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";

interface TabConfig {
  label: string;
  to: string;
}

interface ReviewsPageLayoutProps {
  tabs: TabConfig[];
  isExpanded?: boolean;
  headerDescription: ReactNode;
  headerActions?: ReactNode;
  table: ReactNode;
  detailPanel?: ReactNode;
}

export function ReviewsPageLayout({
  tabs,
  isExpanded = false,
  headerDescription,
  headerActions,
  table,
  detailPanel,
}: ReviewsPageLayoutProps) {
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
                  {tabs.map((tab) => (
                    <NavLink key={tab.to} to={tab.to} end>
                      {({ isActive }) => (
                        <Badge variant={isActive ? "default" : "outline"}>
                          {tab.label}
                        </Badge>
                      )}
                    </NavLink>
                  ))}
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
