import Link from 'next/link'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, Building2, Clock, Users, UserCheck } from 'lucide-react'

const settingsCategories = [
  {
    name: 'Teachers',
    description: 'Manage teacher profiles and assignments',
    href: '/teachers',
    icon: Users,
  },
  {
    name: 'Subs',
    description: 'Manage substitute availability and preferences',
    href: '/subs',
    icon: UserCheck,
  },
  {
    name: 'Class Groups',
    description: 'Manage class group names and hierarchy',
    href: '/settings/classes',
    icon: BookOpen,
  },
  {
    name: 'Classrooms',
    description: 'Manage classroom locations and capacity',
    href: '/settings/classrooms',
    icon: Building2,
  },
  {
    name: 'Days and Time Slots',
    description: 'Configure which days appear in the weekly schedule and manage time periods',
    href: '/settings/timeslots',
    icon: Clock,
  },
]

export default function SettingsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">Configure reference data for the scheduler</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {settingsCategories.map(category => (
          <Link key={category.name} href={category.href}>
            <Card className="hover:bg-accent transition-colors cursor-pointer h-full flex flex-col">
              <CardHeader className="flex-1">
                <div className="flex items-center gap-2">
                  <category.icon className="h-5 w-5 text-muted-foreground" />
                  <CardTitle>{category.name}</CardTitle>
                </div>
                <CardDescription>{category.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
