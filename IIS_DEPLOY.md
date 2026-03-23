# IIS Deploy (Subsitio) + Jenkins CD

Guía para desplegar este editor en **IIS como subsitio** (ej: `/editor3d`) usando Jenkins como CD.

## 1) Arquitectura recomendada

- IIS sirve como **reverse proxy**.
- La app Next.js corre en un proceso Node local (ej: `127.0.0.1:3010`).
- IIS publica el subsitio `/editor3d` y reenvía tráfico al proceso Node.

> Recomendado sobre `iisnode` por estabilidad operativa y mantenimiento.

---

## 2) Prerrequisitos del servidor

Instalar en Windows Server:

- IIS
- URL Rewrite
- ARR (Application Request Routing)
- Node.js 20+
- (Opcional) NSSM o PM2 para correr Node como servicio

En IIS:

- Habilitar proxy en ARR (`Server Proxy Settings` → `Enable proxy`)
- Reiniciar IIS: `iisreset`

---

## 3) Cambios de configuración requeridos (una sola vez)

Para que funcione en subsitio `/editor3d`, la app debe compilar con `basePath`.

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

- `basePath` debe ser `"/editor3d"` en producción.
- `output: 'standalone'` simplifica empaquetado y runtime.

---

## 4) Variables de entorno para producción

Definir al menos:

```env
NODE_ENV=production
PORT=3010
NEXT_PUBLIC_BASE_PATH=/editor3d
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
    NEXT_PUBLIC_BASE_PATH = '/editor3d'
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

          # IIS reverse-proxy rules
          cp apps/editor/web.config deploy/web.config

          cd deploy
          zip -r ../editor3d-deploy.zip .
        '''
      }
    }

    stage('Deploy') {
      steps {
        // Ajustar según tu método: WinRM, SSH, agente local, robocopy, etc.
        // Ejemplo conceptual:
        // 1) Copiar zip al servidor
        // 2) Extraer en C:\inetpub\editor3d
      }
    }

    stage('Restart App') {
      steps {
        // Reiniciar servicio node (NSSM/PM2) y opcionalmente IIS
        // bat 'nssm restart sugop-3d-editor'
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
- `web.config`

---

## 6) `web.config` para el subsitio IIS

Crear `apps/editor/web.config` (y copiar al artifact final):

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="ReverseProxyToNode" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://127.0.0.1:3010/editor3d/{R:1}" />
          <serverVariables>
            <set name="HTTP_X_FORWARDED_PROTO" value="https" />
            <set name="HTTP_X_FORWARDED_HOST" value="{HTTP_HOST}" />
          </serverVariables>
        </rule>
      </rules>
    </rewrite>

    <webSocket enabled="true" />

    <httpProtocol>
      <customHeaders>
        <remove name="X-Powered-By" />
      </customHeaders>
    </httpProtocol>
  </system.webServer>
</configuration>
```

> Este `web.config` se coloca en la raíz física del subsitio (ej: `C:\inetpub\editor3d`).

---

## 7) Crear subsitio en IIS

Ejemplo:

- Sitio principal: `Default Web Site`
- Agregar **Application**:
  - Alias: `editor3d`
  - Physical path: `C:\inetpub\editor3d`
  - App Pool: `No Managed Code`

URL final:

- `https://tu-dominio.com/editor3d`

---

## 8) Proceso Node como servicio

## Opción A: NSSM (simple)

```bat
nssm install sugop-3d-editor "C:\Program Files\nodejs\node.exe" "C:\inetpub\editor3d\server.js"
nssm set sugop-3d-editor AppDirectory "C:\inetpub\editor3d"
nssm set sugop-3d-editor AppEnvironmentExtra NODE_ENV=production PORT=3010 NEXT_PUBLIC_BASE_PATH=/editor3d NEXT_PUBLIC_ALLOWED_PARENT_ORIGIN=https://tu-dominio.com NEXT_PUBLIC_SUGOP_TARGET_ORIGIN=https://tu-dominio.com
nssm start sugop-3d-editor
```

## Opción B: PM2

```bat
pm2 start C:\inetpub\editor3d\server.js --name sugop-3d-editor --cwd C:\inetpub\editor3d --env production
pm2 save
```

---

## 9) Checklist de validación post-deploy

- Abre `https://tu-dominio.com/editor3d` desde iframe de SUGOP.
- Se recibe `sugop-3d-editor:open-context` correctamente.
- Se puede editar (sin bloqueo readOnly).
- Guardar emite `sugop-3d-editor:save` al parent.
- Sin 404 de `/_next/*` ni de assets públicos.
- Sin error de origen no permitido.

---

## 10) Troubleshooting rápido

## 404 en `/_next/static/*`

- Verificar que copiaste `apps/editor/.next/static` al artifact.
- Verificar `NEXT_PUBLIC_BASE_PATH=/editor3d` y build hecho con ese valor.

## `Acceso restringido` / origen no permitido

- Revisar `NEXT_PUBLIC_ALLOWED_PARENT_ORIGIN` (solo origin, sin path).
- Ejemplo correcto: `https://tu-dominio.com`

## No arranca `server.js`

- Confirmar Node 20+ y ruta correcta en servicio.
- Revisar logs del servicio (NSSM/PM2/Event Viewer).

## iframe bloqueado por headers

- Revisar `CSP frame-ancestors` y `X-Frame-Options` en infraestructura/reverse proxy.

---

## 11) Recomendación operativa

Mantener dos jobs Jenkins:

- `editor3d-build` (build + artifact)
- `editor3d-deploy` (deploy + restart + smoke check)

Así separás promoción de artifact y despliegue por ambiente (QA/Prod).
