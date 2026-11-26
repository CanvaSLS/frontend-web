# CanvaSLS · frontend web

Aplicación web de CanvaSLS, la plataforma académica multi-institución. Es una
SPA en React + TypeScript construida con Vite. La sesión se inicia contra
`ms-auth` y, a partir de ahí, la interfaz opera cursos, módulos y materiales,
tareas y entregas, calificaciones, riesgo académico y notificaciones.

## Arquitectura

- Se despliega en **AWS Amplify Hosting** (`amplify.yml`).
- Consume **seis APIs REST** publicadas en API Gateway, una por microservicio:
  `auth`, `cursos`, `eval`, `analitica`, `notif` y `practica`.
- Cada API se configura con una variable `VITE_API_*` (una URL por servicio).
- Todas las llamadas envían el **token que devuelve el login**. El tenant y el
  rol se leen del token, no de la interfaz, así que cada usuario solo ve los
  datos de su institución.
- Vite **incrusta las variables en el bundle al compilar**. Si cambias una URL
  en Amplify, debes volver a desplegar la app para que tome el nuevo valor.

Flujo: Amplify → APIs REST (`VITE_API_*`) → token del login en cada petición.

## Variables de entorno

| Variable | Servicio | Uso |
| --- | --- | --- |
| `VITE_API_AUTH` | `ms-auth` | login, logout y sesión |
| `VITE_API_CURSOS` | `ms-cursos` | cursos, módulos, matrículas y materiales en S3 |
| `VITE_API_EVAL` | `ms-evaluaciones` | tareas, entregas y notas |
| `VITE_API_ANALITICA` | `ms-analitica` | indicadores y semáforo de riesgo |
| `VITE_API_NOTIF` | `ms-notificaciones` | avisos y traza de eventos |
| `VITE_API_PRACTICA` | `ms-practica` | quizzes de repaso corregidos en servidor |

Copia `.env.example` a `.env.local` y completa el `<api-id>` de cada despliegue.
Las URLs no llevan barra final.

## Usuarios de prueba

Las cuentas se siembran por institución. Dominios disponibles:

- `utec.edu.pe`
- `inorte.edu.pe`
- `andino.edu.pe`

Usuarios:

- `profe` — docente
- `ana.torres` — alumna
- `admin` — administrador

El correo se forma con el usuario y el dominio de la institución elegida en el
login (por ejemplo, `profe@utec.edu.pe`). La clave es `Demo2026!`.

## Ejecutar en local

```bash
npm install
npm run dev
```

## Compilar y verificar

```bash
npm run typecheck
npm run build
```

El build genera la carpeta `dist/`, que es la que se publica en Amplify.

## Estructura

- `src/App.tsx`: navegación y pantallas de cursos, tareas, entregas y notas.
- `src/data.ts`: tipos de la interfaz y utilidades de formato.
- `src/live/api.ts`: cliente HTTP de los microservicios; la sesión vive en `sessionStorage`.
- `src/live/adapt.ts`: traducción entre el contrato del backend y los tipos de la interfaz.
- `src/views/Riesgo.tsx`: panel de riesgo y traza de eventos.
- `src/views/Practica.tsx`: quizzes de práctica por curso para alumnos (`ms-practica`).
- `src/styles.css`, `src/skin.css`, `src/canvas.css`: estilos de la interfaz.