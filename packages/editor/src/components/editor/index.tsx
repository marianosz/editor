'use client'

import { initSpaceDetectionSync, initSpatialGridSync, useScene } from '@pascal-app/core'
import { InteractiveSystem, useViewer, Viewer } from '@pascal-app/viewer'
import { Save } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { ViewerOverlay } from '../../components/viewer-overlay'
import { ViewerZoneSystem } from '../../components/viewer-zone-system'
import { type PresetsAdapter, PresetsProvider } from '../../contexts/presets-context'
import { type SaveStatus, useAutoSave } from '../../hooks/use-auto-save'
import { useKeyboard } from '../../hooks/use-keyboard'
import {
  applySceneGraphToEditor,
  loadSceneFromLocalStorage,
  type SceneGraph,
} from '../../lib/scene'
import { initSFXBus } from '../../lib/sfx-bus'
import useEditor from '../../store/use-editor'
import { CeilingSystem } from '../systems/ceiling/ceiling-system'
import { ZoneLabelEditorSystem } from '../systems/zone/zone-label-editor-system'
import { ZoneSystem } from '../systems/zone/zone-system'
import { ToolManager } from '../tools/tool-manager'
import { ActionMenu } from '../ui/action-menu'
import { HelperManager } from '../ui/helpers/helper-manager'
import { PanelManager } from '../ui/panels/panel-manager'
import { Button } from '../ui/primitives/button'
import { Dialog, DialogContent, DialogTitle } from '../ui/primitives/dialog'
import { ErrorBoundary } from '../ui/primitives/error-boundary'
import { SidebarProvider } from '../ui/primitives/sidebar'
import { SceneLoader } from '../ui/scene-loader'
import { AppSidebar } from '../ui/sidebar/app-sidebar'
import type { SettingsPanelProps } from '../ui/sidebar/panels/settings-panel'
import type { SitePanelProps } from '../ui/sidebar/panels/site-panel'
import { CustomCameraControls } from './custom-camera-controls'
import { ExportManager } from './export-manager'
import { FloatingActionMenu } from './floating-action-menu'
import { Grid } from './grid'
import { PresetThumbnailGenerator } from './preset-thumbnail-generator'
import { SelectionManager } from './selection-manager'
import { SiteEdgeLabels } from './site-edge-labels'
import { ThumbnailGenerator } from './thumbnail-generator'

// Load default scene initially (will be replaced when onLoad runs)
useScene.getState().loadScene()
initSpatialGridSync()
initSpaceDetectionSync(useScene, useEditor)

// Auto-select the first building and level for the default scene
const sceneNodes = useScene.getState().nodes as Record<string, any>
const sceneRootIds = useScene.getState().rootNodeIds
const siteNode = sceneRootIds[0] ? sceneNodes[sceneRootIds[0]] : null
const resolve = (child: any) => (typeof child === 'string' ? sceneNodes[child] : child)
const firstBuilding = siteNode?.children?.map(resolve).find((n: any) => n?.type === 'building')
const firstLevel = firstBuilding?.children?.map(resolve).find((n: any) => n?.type === 'level')

if (firstBuilding && firstLevel) {
  useViewer.getState().setSelection({
    buildingId: firstBuilding.id,
    levelId: firstLevel.id,
    selectedIds: [],
    zoneId: null,
  })
  useEditor.getState().setPhase('structure')
  useEditor.getState().setStructureLayer('elements')

  if (!firstLevel.children || firstLevel.children.length === 0) {
    useEditor.getState().setMode('build')
    useEditor.getState().setTool('wall')
  }
}

initSFXBus()

export interface EditorProps {
  // UI slots
  appMenuButton?: ReactNode
  sidebarTop?: ReactNode

  // Persistence — defaults to localStorage when omitted
  onLoad?: () => Promise<SceneGraph | null>
  onSave?: (scene: SceneGraph) => Promise<void>
  onDirty?: () => void
  onSaveStatusChange?: (status: SaveStatus) => void

  // Version preview
  previewScene?: SceneGraph
  isVersionPreviewMode?: boolean

  // Loading indicator (e.g. project fetching in community mode)
  isLoading?: boolean

  // Thumbnail
  onThumbnailCapture?: (blob: Blob) => void

  // Panel config (passed through to sidebar panels)
  settingsPanelProps?: SettingsPanelProps
  sitePanelProps?: SitePanelProps

  // Presets storage backend (defaults to localStorage)
  presetsAdapter?: PresetsAdapter

  // Internal host integration
  readOnly?: boolean
  onManualSave?: (options?: { fileName?: string }) => void
}

function EditorSceneCrashFallback() {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/95 p-4 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-background p-6 shadow-xl">
        <h2 className="font-semibold text-lg">The editor scene failed to render</h2>
        <p className="mt-2 text-muted-foreground text-sm">
          You can retry the scene or return home without reloading the whole app shell.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <button
            className="rounded-md border border-border bg-accent px-3 py-2 font-medium text-sm hover:bg-accent/80"
            onClick={() => window.location.reload()}
            type="button"
          >
            Reload editor
          </button>
          <a
            className="rounded-md border border-border bg-background px-3 py-2 font-medium text-sm hover:bg-accent/40"
            href="/"
          >
            Back to home
          </a>
        </div>
      </div>
    </div>
  )
}

export default function Editor({
  appMenuButton,
  sidebarTop,
  onLoad,
  onSave,
  onDirty,
  onSaveStatusChange,
  previewScene,
  isVersionPreviewMode = false,
  isLoading = false,
  onThumbnailCapture,
  settingsPanelProps,
  sitePanelProps,
  presetsAdapter,
  readOnly = false,
  onManualSave,
}: EditorProps) {
  useKeyboard({ onManualSave, readOnly })

  const { isLoadingSceneRef } = useAutoSave({
    onSave,
    onDirty,
    onSaveStatusChange,
    isVersionPreviewMode,
  })

  const [isSceneLoading, setIsSceneLoading] = useState(false)
  const [isQuickSaveDialogOpen, setIsQuickSaveDialogOpen] = useState(false)
  const [quickSaveFileName, setQuickSaveFileName] = useState('')
  const isPreviewMode = useEditor((s) => s.isPreviewMode)

  const handleQuickSave = () => {
    if (!onManualSave) return

    const currentFileName = settingsPanelProps?.defaultSaveFileName?.trim() ?? ''

    if (currentFileName) {
      onManualSave({ fileName: currentFileName })
      return
    }

    setQuickSaveFileName('')
    setIsQuickSaveDialogOpen(true)
  }

  const handleConfirmQuickSave = () => {
    const fileName = quickSaveFileName.trim()
    if (!fileName) return
    onManualSave?.({ fileName })
    setIsQuickSaveDialogOpen(false)
  }

  useEffect(() => {
    useEditor.getState().setReadOnly(readOnly)
    if (readOnly) {
      useEditor.getState().setMode('select')
      useEditor.getState().setTool(null)
    }
  }, [readOnly])

  // Load scene on mount (or when onLoad identity changes, e.g. project switch)
  useEffect(() => {
    let cancelled = false

    async function load() {
      isLoadingSceneRef.current = true
      setIsSceneLoading(true)

      try {
        const sceneGraph = onLoad ? await onLoad() : loadSceneFromLocalStorage()
        if (!cancelled) {
          applySceneGraphToEditor(sceneGraph)
        }
      } catch {
        if (!cancelled) applySceneGraphToEditor(null)
      } finally {
        if (!cancelled) {
          setIsSceneLoading(false)
          requestAnimationFrame(() => {
            isLoadingSceneRef.current = false
          })
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [onLoad, isLoadingSceneRef])

  // Apply preview scene when version preview mode changes
  useEffect(() => {
    if (isVersionPreviewMode && previewScene) {
      applySceneGraphToEditor(previewScene)
    }
  }, [isVersionPreviewMode, previewScene])

  useEffect(() => {
    document.body.classList.add('dark')
    return () => {
      document.body.classList.remove('dark')
    }
  }, [])

  const showLoader = isLoading || isSceneLoading

  return (
    <PresetsProvider adapter={presetsAdapter}>
      <div className="dark h-full w-full text-foreground">
        {showLoader && <SceneLoader />}

        {isPreviewMode ? (
          <ViewerOverlay onBack={() => useEditor.getState().setPreviewMode(false)} />
        ) : (
          <>
            <ActionMenu />
            <PanelManager />
            <HelperManager />

            <SidebarProvider className="fixed z-20" defaultOpen={false}>
              <AppSidebar
                appMenuButton={appMenuButton}
                settingsPanelProps={{
                  ...settingsPanelProps,
                  readOnly,
                  onSugopSave: (fileName) => onManualSave?.({ fileName }),
                }}
                sidebarTop={sidebarTop}
                sitePanelProps={sitePanelProps}
              />
            </SidebarProvider>
          </>
        )}

        {!isPreviewMode && onManualSave && (
          <>
            <Button
              aria-label="Guardar"
              className="fixed right-4 top-4 z-[65]"
              disabled={readOnly}
              onClick={handleQuickSave}
              type="button"
            >
              <Save className="size-4" />
            </Button>

            <Dialog onOpenChange={setIsQuickSaveDialogOpen} open={isQuickSaveDialogOpen}>
              <DialogContent className="max-w-sm">
                <DialogTitle>Guardar</DialogTitle>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="font-medium text-sm" htmlFor="quick-save-filename">
                      Nombre de archivo
                    </label>
                    <input
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      id="quick-save-filename"
                      onChange={(e) => setQuickSaveFileName(e.target.value)}
                      value={quickSaveFileName}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      onClick={() => setIsQuickSaveDialogOpen(false)}
                      type="button"
                      variant="outline"
                    >
                      Cancelar
                    </Button>
                    <Button
                      disabled={!quickSaveFileName.trim()}
                      onClick={handleConfirmQuickSave}
                      type="button"
                    >
                      Guardar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}

        <ErrorBoundary fallback={<EditorSceneCrashFallback />}>
          <Viewer selectionManager={isPreviewMode ? 'default' : 'custom'}>
            {!isPreviewMode && <SelectionManager />}
            {!isPreviewMode && !readOnly && <FloatingActionMenu />}
            <ExportManager />
            {isPreviewMode ? <ViewerZoneSystem /> : <ZoneSystem />}
            <CeilingSystem />
            {!isPreviewMode && <Grid cellColor="#aaa" fadeDistance={500} sectionColor="#ccc" />}
            {!isPreviewMode && !readOnly && <ToolManager />}
            <CustomCameraControls />
            <ThumbnailGenerator onThumbnailCapture={onThumbnailCapture} />
            <PresetThumbnailGenerator />
            {!isPreviewMode && <SiteEdgeLabels />}
            {isPreviewMode && <InteractiveSystem />}
          </Viewer>
          {!isPreviewMode && !readOnly && <ZoneLabelEditorSystem />}
        </ErrorBoundary>
      </div>
    </PresetsProvider>
  )
}
