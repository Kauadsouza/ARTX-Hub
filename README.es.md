# ARTX Hub

[English](README.md) · [Português](README.pt-BR.md) · **Español**

Un centro privado que reúne los sistemas de Kauã — producción de vídeo, estudio de idiomas, planificación universitaria, el sitio público y el asistente local — en una sola interfaz, **sin fusionar sus códigos, sus bases de datos ni sus fronteras de seguridad**.

[Abrir el Hub](https://artx-hub.vercel.app) · [Descargar para Windows](https://github.com/Kauadsouza/ARTX-Hub/releases/latest) · Requiere autenticación

---

## Por qué existe

Cinco sistemas separados se convierten en cinco pestañas olvidadas, cinco inicios de sesión y cinco lugares donde una tarea puede perderse. Unirlos en un monolito resolvería eso y crearía un problema peor: un fallo en el estudio de vídeo se llevaría por delante la aplicación de estudio.

El Hub es una **capa de orquestación**. Cada producto conserva su propio despliegue, su propia base de datos y su propio ciclo de vida; el Hub les da una puerta común y una sesión común.

## Qué conecta

| Sistema | Para qué sirve | Cómo se integra |
| --- | --- | --- |
| [Site KauaArtx](https://github.com/Kauadsouza/Site-KauaArtx) | Presencia pública bilingüe y marca personal | Aplicación externa |
| [Video Studio](https://github.com/Kauadsouza/KauaArtx-Video-Studio) | Ideas, guiones y publicación en YouTube | Integrada, con la sesión del Hub |
| [Idiomas](https://github.com/Kauadsouza/SAT-simulado) | Inglés y español: estudio diario y exámenes | Integrada, con la sesión del Hub |
| [University Path](https://github.com/Kauadsouza/University-Path) | Candidatura a universidades del Reino Unido | Integrada, con la sesión del Hub |
| [Condor](https://github.com/Kauadsouza/Condor-Ai) | Asistente personal local | Solo vista general y acceso local |

## Aplicación para Windows

El instalador sale de las versiones oficiales y usa la **misma cuenta** que el sitio web: no hay una segunda contraseña. No lleva datos privados ni credenciales, es una carcasa Electron que abre el Hub alojado, así que cualquier cambio en el sitio aparece sin reinstalar.

Desde la versión 1.0.1 **se actualiza solo**: consulta la versión publicada en GitHub, descarga en segundo plano y pregunta antes de reiniciar — nunca interrumpe a quien está en mitad de algo. Esto importa porque el contenido del Hub se renueva solo, pero el Electron que lo envuelve no: sin ese canal, una corrección de seguridad solo llegaría si alguien reinstalara a mano.

Consulta [instalación y seguridad del escritorio](desktop/README.md) y [cómo recuperar el acceso en otro PC](docs/RECOVERY.md).

## Control de acceso

El propietario entra con su cuenta de Supabase. Las demás personas crean una cuenta y quedan **pendientes hasta la aprobación** — y la aprobación es por sistema: se puede habilitar solo Vídeos, solo Idiomas, o lo que tenga sentido. Nada se concede por defecto, y los datos de cada cuenta permanecen separados.

## Decisiones técnicas que merecen mención

- **Orquestación, no monolito.** Cada sistema integrado recibe la sesión por `postMessage` con el origen verificado, en lugar de compartir base de datos.
- **Row Level Security limitada al propietario**, que cubre también los archivos del Storage, no solo las tablas.
- **Ninguna credencial de servicio en el navegador.** Solo la URL y la clave publicable de Supabase llegan al cliente.
- **Electron endurecido:** sandbox, aislamiento de contexto y fuses que desactivan `runAsNode`, la inspección por CLI y la carga fuera del asar.
- **Versiones con procedencia.** La compilación verifica que la etiqueta coincida con la versión, genera SHA256SUMS y emite una atestación de procedencia de GitHub. El instalador aún no está firmado con Authenticode, y eso se declara en la propia publicación en vez de ocultarse.
- **Recuperación documentada con honestidad**, incluido lo que iniciar sesión *no* devuelve (la memoria local de Condor).

## Tecnologías

Next.js 16, React 19, TypeScript, Supabase Auth/PostgreSQL, Electron y Vercel.

## Desarrollo local

```powershell
npm.cmd install
Copy-Item .env.example .env.local
npm.cmd run dev
```

Configuración pública necesaria:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_VIDEOS_URL
NEXT_PUBLIC_SAT_URL
```

Solo los valores públicos de Supabase deben ir en variables del navegador. Nunca uses una clave `service_role` en esta aplicación.

Opcional: `ANTHROPIC_API_KEY` habilita el asistente del Hub en la pestaña Condor. Sin ella, la pestaña explica que aún no está configurada y el resto sigue funcionando.

## Verificación

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd audit --omit=dev
```

## Mapa del repositorio

```text
desktop/          Aplicación Electron y su cadena de publicación
docs/             Recuperación de acceso y procedimientos
src/app/          Shell de la aplicación, rutas y estilos globales
src/components/   Hub, paneles y espacios de trabajo de los sistemas
src/lib/          Registro de proyectos, cliente de Supabase y datos comunes
supabase/         Políticas de base de datos y almacenamiento por propietario
tests/            Comprobaciones de comportamiento e integración
```

## Estado

Infraestructura personal en uso. El código es público para quien quiera revisarlo; el Hub publicado y sus datos son privados por diseño.

Creado y mantenido por [Kauã Diniz Souza](https://github.com/Kauadsouza).
