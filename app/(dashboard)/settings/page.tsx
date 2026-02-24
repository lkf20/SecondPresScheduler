import Link from 'next/link'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Clock, Users, CalendarCheck, UsersRound } from 'lucide-react'
import { getHeaderClasses } from '@/lib/utils/colors'

const settingsSections = [
  {
    title: 'People',
    categories: [
      {
        name: 'Staff',
        description: 'Manage staff profiles, roles, and availability',
        href: '/staff',
        icon: Users,
        iconCircled: false,
        accent: false,
      },
    ],
  },
  {
    title: 'Structure',
    categories: [
      {
        name: 'Days & Time Slots',
        description: 'Configure which days appear in the weekly schedule and manage time periods',
        href: '/settings/timeslots',
        icon: Clock,
        iconCircled: false,
        accent: false,
      },
      {
        name: 'Class Groups',
        description: 'Manage class group names and hierarchy',
        href: '/settings/classes',
        icon: UsersRound,
        iconCircled: true,
        accent: false,
      },
      {
        name: 'Classrooms',
        description: 'Manage classrooms and capacity',
        href: '/settings/classrooms',
        icon: Building2,
        iconCircled: false,
        accent: false,
      },
    ],
  },
  {
    title: 'Scheduling',
    categories: [
      {
        name: 'Baseline Staffing',
        description: 'Manage baseline staffing assignments by classroom, day, and time slot',
        href: '/settings/baseline-schedule',
        icon: CalendarCheck,
        iconCircled: false,
        accent: true,
      },
    ],
  },
]

export default function SettingsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className={getHeaderClasses('3xl')}>Settings</h1>
        <p className="text-muted-foreground mt-2">Configure reference data for the scheduler</p>
      </div>

      <div className="space-y-8">
        {settingsSections.map(section => (
          <section key={section.title}>
            <h2 className="mb-3 text-base font-semibold text-slate-700">{section.title}</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {section.categories.map(category => (
                <Link key={category.name} href={category.href}>
                  <Card
                    className={`transition-colors cursor-pointer h-full flex flex-col ${
                      category.accent
                        ? 'bg-white hover:bg-accent border-slate-200'
                        : 'hover:bg-accent'
                    }`}
                    style={
                      category.accent
                        ? { borderLeftWidth: '4px', borderLeftColor: '#14b8a6' }
                        : undefined
                    }
                  >
                    <CardHeader className="flex-1">
                      <div className="flex items-center gap-2">
                        {category.iconCircled ? (
                          <span
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border"
                            style={{ color: '#64748b', borderColor: '#64748b' }}
                          >
                            <category.icon className="h-4 w-4" />
                          </span>
                        ) : (
                          <category.icon
                            className={`h-5 w-5 ${
                              category.accent ? 'text-teal-700' : 'text-muted-foreground'
                            }`}
                          />
                        )}
                        <CardTitle className={category.accent ? 'text-teal-900' : ''}>
                          {category.name}
                        </CardTitle>
                      </div>
                      <CardDescription>{category.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
