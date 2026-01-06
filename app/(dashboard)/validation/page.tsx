import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ValidationPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Schedule Validation</h1>
        <p className="text-muted-foreground mt-2">Check for conflicts and validation errors</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Validation Report</CardTitle>
          <CardDescription>This feature is coming soon</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Schedule validation will check for:</p>
          <ul className="list-disc list-inside mt-4 space-y-2 text-muted-foreground">
            <li>Conflicts (double bookings, overlapping shifts)</li>
            <li>Missing assignments (time off without subs)</li>
            <li>Staffing rule violations</li>
            <li>Data inconsistencies</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
