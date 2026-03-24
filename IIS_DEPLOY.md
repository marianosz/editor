# 🚀 Deploy SUGOP 3D Editor en IIS (Windows)

Este documento describe el proceso completo de despliegue del **SUGOP 3D Editor (Next.js + Bun)** en un servidor Windows con IIS, incluyendo:

* Script de Jenkins
* Servicio con WinSW
* Reverse proxy con IIS (URL Rewrite + ARR)

---

# 📦 Arquitectura

```
Cliente (browser)
        ↓
IIS (https://sugop-test.infraestructura.gob.ar/3d-editor)
        ↓ (reverse proxy)
http://localhost:8030/3d-editor
        ↓
Next.js (Bun + WinSW)
```

---

# 📁 Estructura de carpetas

```
C:\Sites\SUGOP.3d.Editor\
│
├── editor\                    ← repo clonado
│   ├── apps\editor\          ← app Next.js
│   └── node_modules\
│
└── service\                  ← WinSW
    ├── SUGOP.3d.Editor.Service.exe
    └── SUGOP.3d.Editor.Service.xml
```

---

# ⚙️ Variables de entorno

Archivo generado automáticamente:

```
apps/editor/.env.production
```

Contenido:

```
NODE_ENV=production
NEXT_PUBLIC_BASE_PATH=/3d-editor
NEXT_PUBLIC_ALLOWED_PARENT_ORIGIN=https://sugop-test.infraestructura.gob.ar
NEXT_PUBLIC_SUGOP_TARGET_ORIGIN=https://sugop-test.infraestructura.gob.ar
PORT=8030
SKIP_ENV_VALIDATION=1
HOSTNAME=0.0.0.0
```

⚠️ Importante:

* `basePath` se usa en `next.config.ts`
* el puerto **NO se toma desde .env**, se define en WinSW

---

# 🧠 next.config.ts

Debe incluir:

```ts
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''

const nextConfig = {
  basePath,
}
```

---

# 🛠 Servicio Windows (WinSW)

## 📄 XML

```
C:\Sites\SUGOP.3d.Editor\service\SUGOP.3d.Editor.Service.xml
```

```xml
<service>
  <id>SUGOP.3d.Editor</id>
  <name>SUGOP 3D Editor</name>

  <executable>C:\Windows\System32\config\systemprofile\.bun\bin\bun.exe</executable>
  <arguments>run start -- --port 8030</arguments>

  <workingdirectory>C:\Sites\SUGOP.3d.Editor\editor\apps\editor</workingdirectory>

  <startmode>Automatic</startmode>
  <stoptimeout>15000</stoptimeout>

  <env name="NODE_ENV" value="production" />
  <env name="NEXT_PUBLIC_BASE_PATH" value="/3d-editor" />
  <env name="PORT" value="8030" />
</service>
```

## ▶️ Comandos

```bat
cd C:\Sites\SUGOP.3d.Editor\service

SUGOP.3d.Editor.Service.exe install
SUGOP.3d.Editor.Service.exe start
SUGOP.3d.Editor.Service.exe restart
SUGOP.3d.Editor.Service.exe stop
```

---

# 🤖 Script Jenkins

## 🔧 Pasos clave

1. actualizar repo
2. detener servicio
3. matar procesos node/bun
4. limpiar
5. instalar dependencias
6. build
7. reiniciar servicio

## 📄 Script

```bat
@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM =========================================================
REM Configuracion fija
REM =========================================================
set "REPO_PATH=C:\Sites\SUGOP.3d.Editor\editor"
set "APP_PATH=%REPO_PATH%\apps\editor"
set "ENV_FILE=%APP_PATH%\.env.production"
set "BRANCH=editor_3d"
set "PORT=8030"

REM PATHS necesarios para Jenkins / servicio
set "PATH=C:\Windows\system32\config\systemprofile\.bun\bin;%PATH%"
set "PATH=C:\Users\lgallupi\AppData\Roaming\npm;%PATH%"

echo.
echo ========================================================
echo REPO_PATH = %REPO_PATH%
echo APP_PATH  = %APP_PATH%
echo ENV_FILE  = %ENV_FILE%
echo BRANCH    = %BRANCH%
echo PORT      = %PORT%
echo ========================================================
echo.

REM =========================================================
REM Validaciones
REM =========================================================
if not exist "%REPO_PATH%" (
    echo ERROR: No existe el repo en %REPO_PATH%
    exit /b 1
)

if not exist "%APP_PATH%" (
    echo ERROR: No existe la app en %APP_PATH%
    exit /b 1
)

if not exist "%REPO_PATH%\.git" (
    echo ERROR: %REPO_PATH% no parece ser un repositorio git
    exit /b 1
)

where git >nul 2>&1
if errorlevel 1 (
    echo ERROR: git no esta disponible en PATH
    exit /b 1
)

where bun >nul 2>&1
if errorlevel 1 (
    echo ERROR: bun no esta disponible en PATH
    exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: node no esta disponible en PATH
    exit /b 1
)

echo ===== VERSIONES =====
where bun
bun --version
if errorlevel 1 (
    echo ERROR: no se pudo ejecutar bun
    exit /b 1
)

where node
node --version
if errorlevel 1 (
    echo ERROR: no se pudo ejecutar node
    exit /b 1
)

cd /d "%REPO_PATH%"

REM =========================================================
REM Actualizar repo
REM =========================================================
echo ===== GIT FETCH =====
git fetch --all --prune
if errorlevel 1 exit /b 1

echo ===== REVERTIR CAMBIOS LOCALES =====
git reset --hard
if errorlevel 1 exit /b 1

git clean -fd
if errorlevel 1 exit /b 1

echo ===== GIT CHECKOUT %BRANCH% =====
git checkout %BRANCH%
if errorlevel 1 exit /b 1

echo ===== SINCRONIZAR CONTRA origin/%BRANCH% =====
git reset --hard origin/%BRANCH%
if errorlevel 1 exit /b 1

REM =========================================================
REM Limpieza
REM =========================================================
echo ===== LIMPIEZA =====

echo ===== DETENER SERVICIO WINSW =====
set "SERVICE_DIR=C:\Sites\SUGOP.3d.Editor\service"
set "SERVICE_EXE=%SERVICE_DIR%\SUGOP.3d.Editor.Service.exe"

if exist "%SERVICE_EXE%" (
    call "%SERVICE_EXE%" stop >nul 2>nul
)

if exist "%REPO_PATH%\node_modules" (
    echo Eliminando %REPO_PATH%\node_modules
    rmdir /s /q "%REPO_PATH%\node_modules"
)

if exist "%REPO_PATH%\.turbo" (
    echo Eliminando %REPO_PATH%\.turbo
    rmdir /s /q "%REPO_PATH%\.turbo"
)

if exist "%REPO_PATH%\.next" (
    echo Eliminando %REPO_PATH%\.next
    rmdir /s /q "%REPO_PATH%\.next"
)

if exist "%APP_PATH%\node_modules" (
    echo Eliminando %APP_PATH%\node_modules
    rmdir /s /q "%APP_PATH%\node_modules"
)

if exist "%APP_PATH%\.next" (
    echo Eliminando %APP_PATH%\.next
    rmdir /s /q "%APP_PATH%\.next"
)

if exist "%REPO_PATH%\bun.lock" (
    echo Eliminando %REPO_PATH%\bun.lock
    del /f /q "%REPO_PATH%\bun.lock"
)

if exist "%REPO_PATH%\bun.lockb" (
    echo Eliminando %REPO_PATH%\bun.lockb
    del /f /q "%REPO_PATH%\bun.lockb"
)

echo ===== LIMPIEZA CACHE BUN =====
bun pm cache rm
if errorlevel 1 (
    echo AVISO: No se pudo limpiar la cache de Bun. Continuo igual.
)

REM =========================================================
REM Crear .env.production
REM =========================================================
echo ===== CREANDO .env.production =====

(
echo NODE_ENV=production
echo NEXT_PUBLIC_BASE_PATH=/3d-editor
echo NEXT_PUBLIC_ALLOWED_PARENT_ORIGIN=https://sugop-test.infraestructura.gob.ar
echo NEXT_PUBLIC_SUGOP_TARGET_ORIGIN=https://sugop-test.infraestructura.gob.ar
echo PORT=%PORT%
echo SKIP_ENV_VALIDATION=1
echo HOSTNAME=0.0.0.0
) > "%ENV_FILE%"

if errorlevel 1 (
    echo ERROR: No se pudo crear %ENV_FILE%
    exit /b 1
)

echo ===== CONTENIDO DE .env.production =====
type "%ENV_FILE%"

REM =========================================================
REM Variables de entorno de la sesion actual
REM =========================================================
echo ===== SETEANDO VARIABLES DE ENTORNO =====
set "NODE_ENV=production"
set "NEXT_PUBLIC_BASE_PATH=/3d-editor"
set "NEXT_PUBLIC_ALLOWED_PARENT_ORIGIN=https://sugop-test.infraestructura.gob.ar"
set "NEXT_PUBLIC_SUGOP_TARGET_ORIGIN=https://sugop-test.infraestructura.gob.ar"
set "PORT=%PORT%"
set "SKIP_ENV_VALIDATION=1"
set "HOSTNAME=0.0.0.0"

REM =========================================================
REM Install
REM =========================================================
echo ===== BUN INSTALL =====
cd /d "%REPO_PATH%"
bun install
if errorlevel 1 exit /b 1

REM =========================================================
REM Build
REM =========================================================
echo ===== BUN RUN BUILD =====
cd /d "%APP_PATH%"
bun run build
if errorlevel 1 exit /b 1

if not exist "%APP_PATH%\.next\BUILD_ID" (
    echo ERROR: no se genero el build de Next
    exit /b 1
)

cd /d C:\Sites\SUGOP.3d.Editor\service
SUGOP.3d.Editor.Service.exe restart
if errorlevel 1 exit /b 1

endlocal
exit /b 0
```

---

# 🌐 IIS - Reverse Proxy

## 🔧 Requisitos

Instalar:

* URL Rewrite
* Application Request Routing (ARR)

👉 Descargar URL Rewrite:
https://www.iis.net/downloads/microsoft/url-rewrite

👉 Descargar ARR:
https://www.iis.net/downloads/microsoft/application-request-routing

---

## ⚙️ Instalación

1. Instalar **URL Rewrite**
2. Instalar **ARR**
3. Reiniciar IIS:

```bat
iisreset
```

---

## 🔍 Verificación en IIS

Abrir **Administrador de IIS**:

### ✔ URL Rewrite instalado

En el **sitio** deberías ver:

```text
Reescritura de URL
```

---

### ✔ ARR instalado

En el **nodo del servidor** deberías ver:

```text
Caché de enrutamiento de solicitudes de aplicación
```

---

## ⚙️ Habilitar Proxy (OBLIGATORIO)

1. Seleccionar el **servidor** en IIS
2. Abrir:

```text
Caché de enrutamiento de solicitudes de aplicación
```

3. En el panel derecho:

```text
Configuración de proxy del servidor
```

4. Activar:

```text
✔ Habilitar proxy
```

5. Click en:

```text
Aplicar
```

---

## 📄 Configuración web.config (sitio raíz)

```xml
<rewrite>
  <rules>

    <rule name="ReverseProxy_3DEditor_Root" stopProcessing="true">
      <match url="^3d-editor$" />
      <action type="Rewrite" url="http://localhost:8030/3d-editor" appendQueryString="true" />
    </rule>

    <rule name="ReverseProxy_3DEditor_Subpaths" stopProcessing="true">
      <match url="^3d-editor/(.*)$" />
      <action type="Rewrite" url="http://localhost:8030/3d-editor/{R:1}" appendQueryString="true" />
    </rule>

  </rules>
</rewrite>
```

---

## ⚠️ IMPORTANTE

* ❌ NO crear aplicación IIS `/3d-editor`
* ✔ manejar todo desde el sitio raíz
* ✔ usar **Rewrite**, no Redirect
* ✔ respetar `basePath` en Next.js

---

## 🧪 Testing

### Backend directo

```text
http://localhost:8030/3d-editor
```

### IIS

```text
https://sugop-test.infraestructura.gob.ar/3d-editor
```

---

## 🐞 Problemas comunes

### 404 en IIS

* ARR no instalado
* Proxy no habilitado
* existe app `/3d-editor` en IIS

### 403

* IIS intentando servir contenido local
* regla no aplicada

### Rewrite no funciona

* falta URL Rewrite
* `web.config` en ubicación incorrecta

---

## ✅ Estado esperado

* IIS recibe `/3d-editor`
* IIS reescribe a `http://localhost:8030/3d-editor`
* Next.js responde correctamente
* assets (`_next`) cargan sin errores

---

# ⚠️ IMPORTANTE

* ❌ NO crear aplicación IIS `/3d-editor`
* ✔ manejar todo desde el sitio raíz
* ✔ usar rewrite, NO redirect
* ✔ respetar `basePath`

---

# 🧪 Testing

### Backend directo

```
http://localhost:8030/3d-editor
```

### IIS

```
https://sugop-test.infraestructura.gob.ar/3d-editor
```

---

# 🐞 Problemas comunes

## 403 / 404 en IIS

* falta ARR
* proxy no habilitado
* existe app `/3d-editor`

## bun install falla

* archivos bloqueados
* no se detuvo servicio

## puerto no cambia

* definido en WinSW, no en .env

---

# ✅ Estado final esperado

* servicio WinSW corriendo
* Next.js en puerto 8030
* IIS proxyeando `/3d-editor`
* navegación y assets funcionando

---

# 🧾 Notas

* PM2 descartado (problemas en Windows)
* WinSW usado como service manager
* Bun usado para build/runtime

---

# 🚀 Deploy OK

```
✔ Jenkins build OK
✔ Servicio activo
✔ IIS proxy OK
```
