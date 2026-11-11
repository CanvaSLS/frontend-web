# CanvaSLS · frontend web

Frontend React + TypeScript creado con Vite, Tailwind CSS 4 y npm. Preparado para desplegarse en AWS Amplify.

## Ejecutar

```bash
npm install
npm run dev
```

Para verificar la compilación:

```bash
npm run typecheck
npm run build
```

## Estado actual

La primera versión permite explorar dos instituciones ficticias (UTEC y Norte) y cambiar entre las vistas de alumno y profesor. Incluye Dashboard, cursos, módulos, tareas, calendario, bandeja y calificaciones. El profesor puede publicar una tarea, el alumno puede registrar una entrega y el profesor puede calificarla. El estado se conserva en `localStorage` para facilitar una demo local; usa «Reiniciar» para volver a los datos iniciales.

Esta versión **todavía no tiene autenticación ni API**. El selector de rol y tenant es solo una herramienta de demostración. Tampoco sube el contenido del archivo seleccionado: únicamente muestra y guarda su nombre. La integración posterior conectará Cognito, los microservicios y S3.

## Estructura

- `src/data.ts`: tipos, datos de demostración y persistencia local.
- `src/App.tsx`: navegación, pantallas y flujo de tarea/entrega/nota.
- `src/styles.css`: Tailwind y estilos de interfaz responsive.
- `amplify.yml`: construcción para AWS Amplify Hosting.

## Próximo paso de integración

Definir un cliente HTTP con `tenantId` y token de Cognito, y reemplazar `localStorage` por respuestas de los servicios Académico, Contenidos, Tareas, Evaluación y Notificaciones. El servidor debe validar permisos y aislamiento de tenants; el selector visual no concede acceso por sí mismo.
