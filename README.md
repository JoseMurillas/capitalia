# Capitalia

Sistema privado para administrar préstamos personales y finanzas personales: personas,
préstamos con interés mensual, cuotas, pagos, ingresos/gastos, flujo de caja, dashboard y
reportes.

Construido con Next.js 16 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui,
PostgreSQL, Prisma 7, Auth.js v5, Recharts, Zod y React Hook Form.

## Requisitos

- Node.js 20.9 o superior (probado con Node 24).
- PostgreSQL 14 o superior. Se incluye un `docker-compose.yml` que levanta PostgreSQL 16
  en el puerto `5433` si prefieres no instalarlo.

## Instalación

```bash
npm install
```

## Variables de entorno

Copia `.env.example` a `.env` y ajusta los valores:

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión PostgreSQL usada por Prisma (CLI y runtime). |
| `AUTH_SECRET` | Secreto con el que Auth.js firma la cookie de sesión. Genera uno con `npx auth secret` o `openssl rand -base64 32`. |
| `SEED_ADMIN_NAME` / `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Datos del usuario administrador que crea el seed. |

`.env` nunca se versiona.

## Base de datos

Con Docker (opcional):

```bash
npm run db:up        # levanta PostgreSQL 16 en localhost:5433
```

Genera el cliente, aplica migraciones y carga datos de prueba:

```bash
npx prisma generate
npx prisma migrate dev
npm run db:seed
```

Otros comandos útiles: `npm run db:studio` (Prisma Studio), `npm run db:deploy`
(aplica migraciones sin generar nuevas, para producción), `npm run db:down`.

## Desarrollo

```bash
npm run dev
```

Abre <http://localhost:3000>. Inicia sesión con el usuario definido en las variables
`SEED_ADMIN_*` (por defecto `admin@capitalia.local` / `Admin123*`).

Verificaciones:

```bash
npm run lint
npm run typecheck
npm test
```

## Producción

```bash
npm run build
npm run db:deploy   # aplica migraciones pendientes en la base de producción
npm run start       # sirve la build en el puerto 3000 (PORT para cambiarlo)
```

Define `DATABASE_URL` y `AUTH_SECRET` en el entorno de producción. La aplicación no
expone secretos al cliente: Prisma solo se importa desde `src/server/**`.

## Estructura

```
prisma/               schema, migraciones y seed
prisma.config.ts      configuración de Prisma 7 (URL y seed)
src/proxy.ts          protección de rutas (Next 16: sustituye a middleware.ts)
src/app/              rutas: (auth)/login, (dashboard)/*, api/auth
src/components/       ui (shadcn), shared, layout y componentes por módulo
src/server/           queries (lectura → DTOs), actions ('use server'), services (transacciones)
src/lib/              auth, prisma, format, dates, calculations (puro), validations (zod)
src/hooks/, src/types/
docs/superpowers/specs/  diseño del sistema
```

## Reglas financieras

- El dinero se almacena como `Decimal(15,2)` y se calcula en el servidor con `decimal.js`.
  El cliente solo formatea.
- Interés `SIMPLE`: interés fijo sobre el capital inicial en cada cuota
  (`capital × tasa mensual × meses por periodo`); el capital se reparte en partes iguales
  y el residuo va a la última cuota.
- Los pagos se aplican cuota por cuota, primero al interés pendiente y luego al capital;
  el sobrante pasa a la siguiente cuota. Un pago no puede superar el saldo del préstamo.
- Estados vencidos se sincronizan al consultar (no requiere cron).

La lógica vive en `src/lib/calculations/` y tiene pruebas unitarias (`npm test`).
