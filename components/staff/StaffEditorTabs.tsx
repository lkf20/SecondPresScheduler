'use client'

import { ReactNode } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface EditorSectionConfig {
  title: string
  content: ReactNode
  dirty?: boolean
  actionLabel?: string
  actionFormId?: string
  onAction?: () => void
  triggerDisabled?: boolean
  cardClassName?: string
}

interface StaffEditorTabsProps {
  activeTab: string
  onActiveTabChange: (value: string) => void
  showAvailabilityTab: boolean
  overview: EditorSectionConfig
  availability?: EditorSectionConfig
  preferences: EditorSectionConfig
}

function renderTitle(config: EditorSectionConfig) {
  return (
    <CardTitle className="flex items-center gap-2">
      {config.title}
      {config.dirty && (
        <>
          <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
            Unsaved changes
          </span>
          {(config.actionFormId || config.onAction) && config.actionLabel && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-teal-700 hover:bg-transparent hover:text-teal-800"
              type={config.actionFormId ? 'submit' : 'button'}
              form={config.actionFormId}
              onClick={config.onAction}
            >
              {config.actionLabel}
            </Button>
          )}
        </>
      )}
    </CardTitle>
  )
}

export default function StaffEditorTabs({
  activeTab,
  onActiveTabChange,
  showAvailabilityTab,
  overview,
  availability,
  preferences,
}: StaffEditorTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={onActiveTabChange} className="w-full">
      <TabsList
        className={`grid w-full max-w-2xl ${showAvailabilityTab ? 'grid-cols-3' : 'grid-cols-2'}`}
      >
        <TabsTrigger value="overview" disabled={overview.triggerDisabled}>
          Overview
        </TabsTrigger>
        {showAvailabilityTab && (
          <TabsTrigger value="availability" disabled={availability?.triggerDisabled}>
            Availability
          </TabsTrigger>
        )}
        <TabsTrigger value="preferences" disabled={preferences.triggerDisabled}>
          Preferences & Qualifications
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-6">
        <Card className={overview.cardClassName}>
          <CardHeader>{renderTitle(overview)}</CardHeader>
          <CardContent>{overview.content}</CardContent>
        </Card>
      </TabsContent>

      {showAvailabilityTab && availability && (
        <TabsContent value="availability" className="mt-6">
          <Card className={availability.cardClassName}>
            <CardHeader>{renderTitle(availability)}</CardHeader>
            <CardContent>{availability.content}</CardContent>
          </Card>
        </TabsContent>
      )}

      <TabsContent value="preferences" className="mt-6">
        <Card className={preferences.cardClassName}>
          <CardHeader>{renderTitle(preferences)}</CardHeader>
          <CardContent>{preferences.content}</CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
