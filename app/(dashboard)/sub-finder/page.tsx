import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Search } from 'lucide-react'

export default function SubFinderPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Sub Finder</h1>
        <p className="text-muted-foreground mt-2">Find available substitutes for teacher absences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sub Finder</CardTitle>
          <CardDescription>This feature is coming soon</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            The Sub Finder will help you find available substitutes based on:
          </p>
          <ul className="list-disc list-inside mt-4 space-y-2 text-muted-foreground">
            <li>Sub availability (weekly + exceptions)</li>
            <li>Class preferences</li>
            <li>Classroom preferences</li>
            <li>Existing assignments (conflicts)</li>
            <li>Staffing rules</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}



