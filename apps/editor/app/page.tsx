'use client'

import { useScene } from '@pascal-app/core'
import { Editor, useEditor } from '@pascal-app/editor'
import type { SceneGraph } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type SugopOpenContextPayload = {
  entityType: string
  entityId: number | string
  readOnly?: boolean | string | number | null
  fileId?: number | null
  fileName?: string
  initialContent?: string | SceneGraph
  folder?: string
  displayName?: string
}

type SugopContextState = {
  entityType: string | null
  entityId: number | string | null
  fileId: number | null
  readOnly: boolean
  fileName: string
  folder: string
  displayName?: string
  initialContent?: string
  version: number
}

const DEFAULT_FILE_NAME = ''
const DEFAULT_FOLDER = '3d-editor'
const DEFAULT_CONTENT_TYPE = 'text/plain;charset=utf-8'

const createDefaultContext = (): SugopContextState => ({
  entityType: null,
  entityId: null,
  fileId: null,
  readOnly: false,
  fileName: DEFAULT_FILE_NAME,
  folder: DEFAULT_FOLDER,
  version: 0,
})

function parseAllowedOrigins(value?: string): string[] {
  if (!value) return []

  const normalize = (candidate: string): string | null => {
    const input = candidate.trim()
    if (!input) return null

    try {
      return new URL(input).origin
    } catch {
      return null
    }
  }

  return value
    .split(',')
    .map((origin) => normalize(origin))
    .filter(Boolean)
    .filter((origin, index, all) => all.indexOf(origin) === index) as string[]
}

function parseSceneGraph(input?: string | SceneGraph): SceneGraph | null {
  if (!input) return null

  const parsed = (() => {
    if (typeof input === 'string') {
      if (!input.trim()) return null
      try {
        return JSON.parse(input) as Partial<SceneGraph>
      } catch {
        return null
      }
    }

    return input as Partial<SceneGraph>
  })()

  if (!parsed) return null

  const hasValidNodes = !!parsed.nodes && typeof parsed.nodes === 'object'
  const hasValidRootIds = Array.isArray(parsed.rootNodeIds)

  if (!hasValidNodes || !hasValidRootIds) {
    return null
  }

  return {
    nodes: parsed.nodes as Record<string, unknown>,
    rootNodeIds: parsed.rootNodeIds as string[],
  }
}

export default function Home() {
  const [context, setContext] = useState<SugopContextState>(() => createDefaultContext())
  const [saveNotice, setSaveNotice] = useState<string | null>(null)
  const [isAuthorizedEmbed, setIsAuthorizedEmbed] = useState(false)
  const [accessError, setAccessError] = useState<string | null>(null)
  const hasRequestedContext = useRef(false)

  const allowedOrigins = useMemo(
    () => parseAllowedOrigins(process.env.NEXT_PUBLIC_ALLOWED_PARENT_ORIGIN),
    [],
  )

  const targetOrigin = useMemo(() => {
    const configured = process.env.NEXT_PUBLIC_SUGOP_TARGET_ORIGIN?.trim()
    if (configured) return configured
    return allowedOrigins[0] ?? ''
  }, [allowedOrigins])

  const isAllowedOrigin = useCallback(
    (origin: string) => {
      if (allowedOrigins.length === 0) return false
      return allowedOrigins.includes(origin)
    },
    [allowedOrigins],
  )

  const saveToSugop = useCallback((options?: { fileName?: string }) => {
    if (!isAuthorizedEmbed) {
      setSaveNotice('Acceso bloqueado. Abre el editor desde SUGOP.')
      return
    }

    if (!targetOrigin) {
      setSaveNotice('Configura NEXT_PUBLIC_SUGOP_TARGET_ORIGIN para habilitar guardado.')
      return
    }

    const { nodes, rootNodeIds } = useScene.getState()
    const hasEditableContent = Object.values(nodes ?? {}).some((node) => {
      if (!node || typeof node !== 'object') return false
      const nodeType = (node as { type?: unknown }).type
      return typeof nodeType === 'string' && !['site', 'building', 'level'].includes(nodeType)
    })

    if (!hasEditableContent) {
      setSaveNotice('No hay contenido para guardar.')
      return
    }

    const sceneGraph: SceneGraph = {
      nodes: nodes as Record<string, unknown>,
      rootNodeIds: rootNodeIds as string[],
    }

    const content = JSON.stringify(sceneGraph, null, 2)
    const fileName = options?.fileName?.trim() || context.fileName || undefined

    window.parent.postMessage(
      {
        type: 'sugop-3d-editor:save',
        payload: {
          content,
          ...(typeof context.fileId === 'number' && context.fileId > 0
            ? { fileId: context.fileId }
            : {}),
          fileName,
          displayName: context.displayName,
          folder: context.folder || DEFAULT_FOLDER,
          contentType: DEFAULT_CONTENT_TYPE,
        },
      },
      targetOrigin,
    )

    if (fileName !== context.fileName) {
      setContext((prev) => ({ ...prev, fileName }))
    }

    setSaveNotice('Contenido enviado a SUGOP.')
  }, [
    context.displayName,
    context.fileId,
    context.fileName,
    context.folder,
    isAuthorizedEmbed,
    targetOrigin,
  ])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.self === window.top) return
    if (!targetOrigin || hasRequestedContext.current) return

    window.parent.postMessage({ type: 'sugop-3d-editor:request-context' }, targetOrigin)
    hasRequestedContext.current = true
  }, [targetOrigin])

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (window.self === window.top) {
      setAccessError('Acceso no autorizado: este editor solo funciona embebido en SUGOP.')
      setIsAuthorizedEmbed(false)
      return
    }

    if (allowedOrigins.length === 0) {
      setAccessError(
        'Acceso bloqueado: configura NEXT_PUBLIC_ALLOWED_PARENT_ORIGIN con el origen permitido.',
      )
      setIsAuthorizedEmbed(false)
      return
    }

    setAccessError(null)
  }, [allowedOrigins])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!isAllowedOrigin(event.origin)) {
        setAccessError(`Origen no permitido: ${event.origin}`)
        return
      }

      const data = event.data as { type?: string; payload?: SugopOpenContextPayload } | null
      if (!data?.type) return

      if (data.type === 'sugop-3d-editor:open-context') {
        const payload = data.payload
        if (!payload) return

        setIsAuthorizedEmbed(true)
        setAccessError(null)

        const sceneGraph = parseSceneGraph(payload.initialContent)

        if (sceneGraph) {
          useScene.getState().setScene(sceneGraph.nodes as any, sceneGraph.rootNodeIds as any)
        } else {
          useScene.getState().clearScene()
        }

        useViewer.getState().resetSelection()
        useEditor.getState().setPhase('structure')
        useEditor.getState().setStructureLayer('elements')
        useEditor.getState().setMode('build')
        useEditor.getState().setTool('wall')

        setContext((prev) => ({
          entityType: payload.entityType,
          entityId: payload.entityId,
          fileId: typeof payload.fileId === 'number' ? payload.fileId : null,
          readOnly: false,
          fileName: payload.fileName?.trim() || '',
          folder: payload.folder?.trim() || DEFAULT_FOLDER,
          displayName: payload.displayName,
          initialContent: sceneGraph ? JSON.stringify(sceneGraph) : undefined,
          version: prev.version + 1,
        }))
        setSaveNotice(null)
        return
      }

      if (data.type === 'sugop-3d-editor:trigger-save') {
        saveToSugop()
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [isAllowedOrigin, saveToSugop])

  const loadFromContext = useCallback(async () => {
    return parseSceneGraph(context.initialContent)
  }, [context.initialContent])

  return (
    <div className="h-screen w-screen">
      {isAuthorizedEmbed ? (
        <Editor
          key={context.version}
          onLoad={loadFromContext}
          onManualSave={saveToSugop}
          readOnly={context.readOnly}
          settingsPanelProps={{
            defaultSaveFileName: context.fileName,
            onSugopFileNameReset: () =>
              setContext((prev) => ({
                ...prev,
                fileName: '',
              })),
          }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-background px-6 text-foreground">
          <div className="w-full max-w-md rounded-xl border border-border/60 bg-card p-6 shadow-sm">
            <h1 className="font-semibold text-lg">Acceso restringido</h1>
            <p className="mt-2 text-muted-foreground text-sm">
              {accessError ?? 'Esperando contexto de apertura desde SUGOP...'}
            </p>
          </div>
        </div>
      )}
      {saveNotice && (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-[70] -translate-x-1/2 rounded-md border border-border/50 bg-background/95 px-3 py-2 text-xs text-foreground shadow-lg">
          {saveNotice}
        </div>
      )}
    </div>
  )
}
