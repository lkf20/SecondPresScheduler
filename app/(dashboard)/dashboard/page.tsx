import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Search, Users, UserCheck, Calendar, FileText, Settings } from 'lucide-react'

const quickActions = [
  {
    name: 'Sub Finder',
    description: 'Find available substitutes',
    href: '/sub-finder',
    icon: Search,
  },
  {
    name: 'Teachers',
    description: 'Manage teacher schedules',
    href: '/teachers',
    icon: Users,
  },
  {
    name: 'Subs',
    description: 'Manage substitute availability',
    href: '/subs',
    icon: UserCheck,
  },
  {
    name: 'Assignments',
    description: 'View and manage assignments',
    href: '/assignments',
    icon: Calendar,
  },
  {
    name: 'Reports',
    description: 'View schedules and reports',
    href: '/reports',
    icon: FileText,
  },
  {
    name: 'Settings',
    description: 'Configure classes, classrooms, and timeslots',
    href: '/settings',
    icon: Settings,
  },
]

export default async function DashboardPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome to the Scheduler. Manage teachers, subs, and assignments.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {quickActions.map((action) => (
          <Link key={action.name} href={action.href}>
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <action.icon className="h-5 w-5 text-muted-foreground" />
                  <CardTitle>{action.name}</CardTitle>
                </div>
                <CardDescription>{action.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}



