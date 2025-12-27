import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AssignmentsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Assignments</h1>
        <p className="text-muted-foreground mt-2">View and manage sub assignments</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Master Calendar</CardTitle>
          <CardDescription>This feature is coming soon</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            The master calendar will display all sub assignments with the ability to:
          </p>
          <ul className="list-disc list-inside mt-4 space-y-2 text-muted-foreground">
            <li>View assignments by date range</li>
            <li>Create, edit, and delete assignments</li>
            <li>Filter by teacher, sub, or classroom</li>
            <li>Export to calendar formats</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}



