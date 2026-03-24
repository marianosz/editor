'use client'

import { type ReactNode, useEffect, useState } from 'react'
import { CommandPalette } from './../../../components/ui/command-palette'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  useSidebarStore,
} from './../../../components/ui/primitives/sidebar'
import { cn } from './../../../lib/utils'
import { IconRail, type PanelId } from './icon-rail'
import { SettingsPanel, type SettingsPanelProps } from './panels/settings-panel'
import { SitePanel, type SitePanelProps } from './panels/site-panel'

interface AppSidebarProps {
  appMenuButton?: ReactNode
  sidebarTop?: ReactNode
  settingsPanelProps?: SettingsPanelProps
  sitePanelProps?: SitePanelProps
}

export function AppSidebar({
  appMenuButton,
  sidebarTop,
  settingsPanelProps,
  sitePanelProps,
}: AppSidebarProps) {
  const [activePanel, setActivePanel] = useState<PanelId>('site')
  const [isCollapsed, setIsCollapsed] = useState(true)

  useEffect(() => {
    // Widen default sidebar (288px → 432px) for better project title visibility
    const store = useSidebarStore.getState()
    if (store.width <= 288) {
      store.setWidth(432)
    }
  }, [])

  const renderPanelContent = () => {
    switch (activePanel) {
      case 'site':
        return <SitePanel {...sitePanelProps} />
      case 'settings':
        return <SettingsPanel {...settingsPanelProps} />
      default:
        return null
    }
  }

  const handlePanelChange = (panel: PanelId) => {
    if (panel === activePanel) {
      setIsCollapsed((prev) => !prev)
      return
    }

    setActivePanel(panel)
    setIsCollapsed(false)
  }

  return (
    <>
      <Sidebar className={cn('dark text-white')} variant="floating">
        <div className="flex h-full">
          {/* Icon Rail */}
          <IconRail
            activePanel={activePanel}
            appMenuButton={appMenuButton}
            onPanelChange={handlePanelChange}
          />

          {/* Panel Content */}
          <div
            className={cn(
              'flex flex-1 flex-col overflow-hidden transition-[max-width,opacity] duration-200 ease-linear',
              isCollapsed && 'pointer-events-none max-w-0 opacity-0',
            )}
          >
            {sidebarTop && (
              <SidebarHeader className="relative flex-col items-start justify-center gap-1 border-border/50 border-b px-3 py-3">
                {sidebarTop}
              </SidebarHeader>
            )}

            <SidebarContent className={cn('no-scrollbar flex flex-1 flex-col overflow-hidden')}>
              {renderPanelContent()}
            </SidebarContent>
          </div>
        </div>
      </Sidebar>
      <CommandPalette />
    </>
  )
}
