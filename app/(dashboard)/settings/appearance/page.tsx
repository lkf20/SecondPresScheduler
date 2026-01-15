'use client'

import { Card, CardDescription, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { useTheme } from '@/lib/contexts/ThemeContext'
import { Palette } from 'lucide-react'

export default function AppearancePage() {
  const { theme, setTheme, isLoading } = useTheme()

  const handleThemeChange = async (newTheme: 'system' | 'accented') => {
    await setTheme(newTheme)
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Appearance</h1>
        <p className="text-muted-foreground mt-2">Customize the look and feel of the application</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Theme</CardTitle>
          </div>
          <CardDescription>
            Choose a color theme for the application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={theme}
            onValueChange={handleThemeChange}
            disabled={isLoading}
            className="space-y-4"
          >
            <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
              <RadioGroupItem value="system" id="system" className="mt-1" />
              <div className="flex-1 space-y-1">
                <Label htmlFor="system" className="cursor-pointer font-medium">
                  System
                </Label>
                <p className="text-sm text-muted-foreground">
                  Light theme with standard colors. Clean and minimal design.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
              <RadioGroupItem value="accented" id="accented" className="mt-1" />
              <div className="flex-1 space-y-1">
                <Label htmlFor="accented" className="cursor-pointer font-medium">
                  Accented
                </Label>
                <p className="text-sm text-muted-foreground">
                  Dark navy navigation panel with teal/turquoise primary action buttons. Modern and distinctive.
                </p>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>
    </div>
  )
}
