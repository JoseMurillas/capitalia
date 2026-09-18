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

## Pruebas

```bash
npm run lint         # ESLint
npm run typecheck    # TypeScript estricto
npm test             # Vitest: cálculos financieros, fechas y formato
npm run test:e2e     # Playwright: flujo completo en navegador (requiere la BD con seed)
```

Para las pruebas end-to-end instala el navegador una vez con `npx playwright install chromium`.
Levantan `next dev` en el puerto 3100 (o reutilizan uno abierto) y crean registros de prueba en
la base de datos configurada; `npm run db:seed` la deja limpia de nuevo.

## Producción

```bash
npm run build       # genera el cliente Prisma y compila Next
npm run db:deploy   # aplica migraciones pendientes en la base de producción
npm run start       # sirve la build en el puerto 3000 (PORT para cambiarlo)
```

Define `DATABASE_URL` y `AUTH_SECRET` en el entorno de producción. La aplicación no
expone secretos al cliente: Prisma solo se importa desde `src/server/**`.

### Despliegue en Vercel

1. **Base de datos**: crea un PostgreSQL gestionado (Neon, Supabase o Prisma Postgres desde el
   Marketplace de Vercel). Usa la cadena de conexión *pooled* si el proveedor la ofrece.
2. **Variables de entorno** en el proyecto de Vercel: `DATABASE_URL` y `AUTH_SECRET`
   (genera uno con `openssl rand -base64 32`). Opcionalmente `SEED_ADMIN_*` si vas a ejecutar
   el seed contra esa base.
3. **Build**: Vercel ejecuta `vercel-build`, que genera el cliente Prisma, aplica las
   migraciones (`prisma migrate deploy`) y compila. Si prefieres migrar a mano, cambia el
   Build Command a `npm run build` y ejecuta `npm run db:deploy` desde tu máquina con la
   `DATABASE_URL` de producción.
4. **Usuario administrador**: la base nueva está vacía. Créalo desde tu máquina apuntando a
   producción y con `SEED_ONLY_ADMIN=true`, que crea/actualiza solo el admin **sin** borrar ni
   cargar datos de ejemplo:

   ```bash
   # bash
   DATABASE_URL="<url de producción>" SEED_ONLY_ADMIN=true SEED_ADMIN_EMAIL=tu@correo.com SEED_ADMIN_PASSWORD='Clave-segura-1' npm run db:seed
   ```

   ```powershell
   # PowerShell
   $env:DATABASE_URL="<url de producción>"; $env:SEED_ONLY_ADMIN="true"; $env:SEED_ADMIN_EMAIL="tu@correo.com"; $env:SEED_ADMIN_PASSWORD="Clave-segura-1"; npm run db:seed
   ```

   Sin `SEED_ONLY_ADMIN` el seed **reemplaza** todas las personas, préstamos y movimientos por
   los datos de prueba: úsalo solo en desarrollo.
5. Conecta el repositorio en vercel.com y despliega. Las fechas de negocio se calculan en
   `America/Bogota` sin importar la región del servidor.

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
e2e/                  pruebas Playwright (flujo completo y navegación móvil)
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
