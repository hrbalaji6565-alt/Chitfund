"use client";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";

export default function CollectionPage() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Collection Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Manage all collections efficiently with responsive layout.</p>
        </CardContent>
      </Card>
    </div>
  );
}
