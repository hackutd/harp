import { useEffect, useState } from "react";
import { getRequest, errorAlert } from "@/lib/api";
import type { Scan } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Scans() {
  const [loading, setLoading] = useState(true);
  const [scans, setScans] = useState<Scan[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const res = await getRequest<Scan[]>("/v1/admin/scans", "scans");
      if (res.status === 200 && res.data) {
        setScans(res.data);
      } else {
        errorAlert(res);
      }
      setLoading(false);
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Scans</h1>
        <p className="text-gray-600 mt-2">
          View and manage event check-in scans
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Scans</CardTitle>
          <CardDescription>{scans.length} scan(s) recorded</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User ID</TableHead>
                <TableHead>Event Type</TableHead>
                <TableHead>Scanned By</TableHead>
                <TableHead>Scanned At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scans.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-gray-500"
                  >
                    No scans found
                  </TableCell>
                </TableRow>
              ) : (
                scans.map((scan) => (
                  <TableRow key={scan.id}>
                    <TableCell className="font-mono text-sm">
                      {scan.userId.substring(0, 8)}...
                    </TableCell>
                    <TableCell className="font-medium">
                      {scan.eventType}
                    </TableCell>
                    <TableCell>{scan.scannedBy}</TableCell>
                    <TableCell>
                      {new Date(scan.scannedAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scan Management</CardTitle>
          <CardDescription>Tools for managing scans</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">
            QR code scanning and event check-in tools coming soon.
          </p>
          <Button variant="outline" disabled>
            Generate QR Code
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
