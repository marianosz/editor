# IIS Deploy (Subsitio) + Jenkins CD

Guía para desplegar este editor en **IIS como subsitio** (ej: `/3d-editor`) usando Jenkins como CD.

## 1) Arquitectura recomendada

- IIS ejecuta `server.js` directamente mediante **iisnode**.
- La app Next.js corre dentro del worker process de IIS (sin servicio Node separado).
- IIS publica el subsitio `/3d-editor` y enruta a `server.js` dentro de la misma aplicación.

> Este documento queda orientado al escenario solicitado: **iisnode**.

---

## 2) Prerrequisitos del servidor

Instalar en Windows Server:

- IIS
- iisnode
- URL Rewrite
- Node.js 20+

En IIS, tras instalar iisnode, reiniciar: `iisreset`

---

## 3) Cambios de configuración requeridos (una sola vez)

Para que funcione en subsitio `/3d-editor`, la app debe compilar con `basePath`.

En `apps/editor/next.config.ts` agregar:

```ts
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''

const nextConfig: NextConfig = {
  basePath,
  output: 'standalone',
  // ...resto
}
```

Notas:

- `basePath` debe ser `"/3d-editor"` en producción.
- `output: 'standalone'` simplifica empaquetado y runtime.

---

## 4) Variables de entorno para producción

Definir al menos:

```env
NODE_ENV=production
NEXT_PUBLIC_BASE_PATH=/3d-editor
NEXT_PUBLIC_ALLOWED_PARENT_ORIGIN=https://tu-dominio.com
NEXT_PUBLIC_SUGOP_TARGET_ORIGIN=https://tu-dominio.com
```

Contrato de eventos vigente:

- Entrada: `sugop-3d-editor:open-context`
- Entrada: `sugop-3d-editor:trigger-save`
- Salida: `sugop-3d-editor:save`

---

## 5) Build y empaquetado en Jenkins

## 5.1 Pipeline (ejemplo `Jenkinsfile`)

```groovy
pipeline {
  agent any

  environment {
    NEXT_PUBLIC_BASE_PATH = '/3d-editor'
    NEXT_PUBLIC_ALLOWED_PARENT_ORIGIN = 'https://tu-dominio.com'
    NEXT_PUBLIC_SUGOP_TARGET_ORIGIN = 'https://tu-dominio.com'
    NODE_ENV = 'production'
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Install') {
      steps {
        sh 'bun install'
      }
    }

    stage('Build') {
      steps {
        sh 'bun --cwd apps/editor run build'
      }
    }

    stage('Package') {
      steps {
        sh '''
          rm -rf deploy
          mkdir -p deploy

          # Standalone runtime
          cp -R apps/editor/.next/standalone/* deploy/

          # Static assets Next
          mkdir -p deploy/apps/editor/.next
          cp -R apps/editor/.next/static deploy/apps/editor/.next/

          # Public assets
          cp -R apps/editor/public deploy/apps/editor/

          cd deploy
          zip -r ../3d-editor-deploy.zip .
        '''
      }
    }

    stage('Deploy') {
      steps {
        // Ajustar según tu método: WinRM, SSH, agente local, robocopy, etc.
        // Ejemplo conceptual:
        // 1) Copiar zip al servidor
        // 2) Extraer en C:\inetpub\3d-editor
      }
    }

    stage('Restart App') {
      steps {
        // Reciclar App Pool o ejecutar iisreset
        // bat 'iisreset'
      }
    }
  }
}
```

## 5.2 Artifact esperado

El ZIP final debe contener:

- `server.js` (raíz)
- `apps/editor/.next/static`
- `apps/editor/public`

---

## 6) Crear subsitio en IIS

Ejemplo:

- Sitio principal: `Default Web Site`
- Agregar **Application**:
  - Alias: `3d-editor`
  - Physical path: `C:\inetpub\3d-editor`
  - App Pool: `No Managed Code`

URL final:

- `https://tu-dominio.com/3d-editor`

---

## 7) Ejecución con iisnode (sin servicio externo)

- No usar NSSM/PM2 para esta modalidad.
- El proceso se administra desde el App Pool de IIS.
- Después de deploy, reciclar el App Pool o ejecutar `iisreset`.

---

## 8) Checklist de validación post-deploy

- Abre `https://tu-dominio.com/3d-editor` desde iframe de SUGOP.
- Se recibe `sugop-3d-editor:open-context` correctamente.
- Se puede editar (sin bloqueo readOnly).
- Guardar emite `sugop-3d-editor:save` al parent.
- Sin 404 de `/_next/*` ni de assets públicos.
- Sin error de origen no permitido.

---

## 9) Troubleshooting rápido

## 404 en `/_next/static/*`

- Verificar que copiaste `apps/editor/.next/static` al artifact.
- Verificar `NEXT_PUBLIC_BASE_PATH=/3d-editor` y build hecho con ese valor.

## `Acceso restringido` / origen no permitido

- Revisar `NEXT_PUBLIC_ALLOWED_PARENT_ORIGIN` (solo origin, sin path).
- Ejemplo correcto: `https://tu-dominio.com`

## No arranca `server.js`

- Confirmar que `iisnode` está instalado en el servidor.
- Confirmar Node 20+ instalado para IIS.
- Revisar logs de iisnode (`iisnode` genera logs en el sitio) y Event Viewer.

## iframe bloqueado por headers

- Revisar `CSP frame-ancestors` y `X-Frame-Options` en IIS/reverse proxy frontal (si existe).

---

## 11) Recomendación operativa

Mantener dos jobs Jenkins:

- `3d-editor-build` (build + artifact)
- `3d-editor-deploy` (deploy + restart + smoke check)

Así separás promoción de artifact y despliegue por ambiente (QA/Prod).
