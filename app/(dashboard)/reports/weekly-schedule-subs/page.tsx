import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function WeeklyScheduleWithSubsReportPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Weekly Schedule with Subs</h1>
        <p className="text-muted-foreground mt-2">Generate weekly schedule including sub assignments</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Schedule with Subs Report</CardTitle>
          <CardDescription>This feature is coming soon</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This report will generate a printable weekly schedule showing all teacher and sub assignments.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

