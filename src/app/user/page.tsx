"use client";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";

export default function UserPage() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Welcome User!</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Your dashboard is optimized for mobile and desktop.</p>
        </CardContent>
      </Card>
    </div>
  );
}
