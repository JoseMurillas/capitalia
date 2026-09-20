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

Genera el cliente y aplica las migraciones (crean las tablas, categorías, estados y métodos
de pago; la base queda lista pero sin registros):

```bash
npx prisma generate
npx prisma migrate dev
```

Luego elige una de las dos:

```bash
npm run db:admin   # solo crea el usuario administrador (base limpia, para uso real)
npm run db:seed    # admin + personas, préstamos, pagos y movimientos de ejemplo (desarrollo)
```

Ambos leen `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD`. `db:seed`
**reemplaza** todos los datos de negocio por los de ejemplo cada vez que se ejecuta.

Otros comandos: `npm run db:studio` (Prisma Studio), `npm run db:deploy` (aplica migraciones
sin generar nuevas, para producción), `npm run db:clear` (borra personas, préstamos, pagos y
movimientos conservando usuarios; exige `CONFIRM_CLEAR=yes`), `npm run db:down`.

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
4. **Usuario administrador**: la base nueva ya tiene tablas, categorías y estados, pero ningún
   registro. Crea el admin desde tu máquina apuntando a producción (usa la cadena directa,
   `DATABASE_URL_UNPOOLED` en Neon):

   ```bash
   # bash
   DATABASE_URL="<url directa de producción>" SEED_ADMIN_NAME="Tu nombre" SEED_ADMIN_EMAIL=tu@correo.com SEED_ADMIN_PASSWORD='Clave-segura-1' npm run db:admin
   ```

   ```powershell
   # PowerShell
   $env:DATABASE_URL="<url directa de producción>"; $env:SEED_ADMIN_NAME="Tu nombre"; $env:SEED_ADMIN_EMAIL="tu@correo.com"; $env:SEED_ADMIN_PASSWORD="Clave-segura-1"; npm run db:admin
   ```

   `db:admin` nunca toca los datos de negocio; volver a ejecutarlo solo actualiza nombre y
   contraseña. **No ejecutes `db:seed` contra producción**: cargaría los datos de ejemplo.
   Si ya lo hiciste, `CONFIRM_CLEAR=yes npm run db:clear` los elimina y conserva tu usuario.
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

## Bandeja del banco (gastos automáticos por correo)

Capitalia puede recibir los correos de alerta de tu banco y proponerte cada movimiento en
**Finanzas → Bandeja del banco**, donde lo confirmas (o corriges tipo, monto, fecha y
categoría) con un clic. Nada se registra sin tu confirmación.

1. En la app: **Configuración → Bandeja del banco → Generar clave**. Se muestra el script de
   Google ya listo con tu URL y tu clave (la clave se guarda cifrada y no se vuelve a mostrar).
2. En Gmail, crea un filtro para los correos de tu banco que aplique la etiqueta `capitalia`.
3. Pega el script en un proyecto de [script.google.com](https://script.google.com), ejecútalo una
   vez para autorizarlo y crea un activador cada 5 minutos. (Como alternativa también se acepta
   la variable de entorno `INBOX_TOKEN`.)

El endpoint `POST /api/inbox` acepta `{ "source": "email" | "sms", "messages": [{ externalId,
receivedAt, sender, subject, text }] }` con `Authorization: Bearer <INBOX_TOKEN>`; es
idempotente (un mismo `externalId` no se duplica), así que también sirve desde un Atajo de
iOS para SMS o desde cualquier otra automatización.

## Reglas financieras

- El dinero se almacena como `Decimal(15,2)` y se calcula en el servidor con `decimal.js`.
  El cliente solo formatea.
- Interés `SIMPLE`: interés fijo sobre el capital inicial en cada cuota
  (`capital × tasa mensual × meses por periodo`); el capital se reparte en partes iguales
  y el residuo va a la última cuota.
- Al registrar un pago se elige a qué se aplica:
  - **Cuota (automático)**: cuota por cuota, primero al interés pendiente y luego al capital;
    el sobrante pasa a la siguiente cuota. No puede superar el saldo del préstamo.
  - **Solo intereses**: cubre únicamente intereses pendientes; el capital no cambia.
  - **Abono a capital**: reduce el capital pendiente y recalcula las cuotas restantes sobre el
    nuevo saldo (menos interés de ahí en adelante). El interés ya cobrado no se reduce.
- Estados vencidos se sincronizan al consultar (no requiere cron).

La lógica vive en `src/lib/calculations/` y tiene pruebas unitarias (`npm test`).
