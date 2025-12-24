import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SubAvailabilityReportPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Sub Availability</h1>
        <p className="text-muted-foreground mt-2">View sub availability matrix</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sub Availability Report</CardTitle>
          <CardDescription>This feature is coming soon</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This report will display a matrix of all subs and their availability by day and time slot.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

