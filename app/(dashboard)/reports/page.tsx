import Link from 'next/link'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Users } from 'lucide-react'
import { getHeaderClasses } from '@/lib/utils/colors'

const reports = [
  {
    name: "Today's Schedule",
    description: 'Printable daily schedule snapshot',
    href: '/reports/daily-schedule',
    icon: Calendar,
  },
  {
    name: 'Sub Availability',
    description: 'View sub availability matrix',
    href: '/reports/sub-availability',
    icon: Users,
  },
]

export default function ReportsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className={getHeaderClasses('3xl')}>Reports</h1>
        <p className="text-muted-foreground mt-2">Generate schedules and availability reports</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map(report => (
          <Link key={report.name} href={report.href}>
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <report.icon className="h-5 w-5 text-muted-foreground" />
                  <CardTitle>{report.name}</CardTitle>
                </div>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
