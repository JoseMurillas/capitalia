# Capitalia — Diseño del sistema

Fecha: 2026-09-18 · Estado: aprobado (Parte 1 explícitamente; Parte 2 con decisiones por defecto documentadas aquí)

## 1. Objetivo

Sistema privado (un solo administrador) para gestionar préstamos personales y finanzas
personales: personas, préstamos, cuotas, pagos, ingresos/gastos, flujo de caja, dashboard
y reportes. Sin banca real ni integraciones externas.

## 2. Stack (versiones verificadas en npm el 2026-09-18)

| Paquete | Versión | Rol |
|---|---|---|
| next / react / react-dom | 16.3.5 / 19.2.x | Framework (App Router, Turbopack) |
| typescript 5, tailwindcss 4, eslint 9 | — | Base |
| shadcn CLI 4.21 (base Radix, CSS variables) | — | UI |
| lucide-react 1.47, sonner 2 | — | Iconos, toasts |
| prisma / @prisma/client 7.10.0 | — | ORM (Prisma 7: driver adapters + `prisma.config.ts`) |
| @prisma/adapter-pg 7.10.0, pg 8.23 | — | Driver PostgreSQL |
| next-auth 5.0.0-beta.32 (Auth.js v5) | — | Autenticación (Credentials + JWT) |
| bcryptjs 3 | — | Hash de contraseñas |
| zod 4.6, react-hook-form 7.88, @hookform/resolvers 5.9 | — | Validación y formularios |
| recharts 3.10 | — | Gráficos |
| decimal.js 10 | — | Aritmética monetaria en servidor |
| date-fns 4.4 | — | Fechas (locale `es`) |
| tsx 4 (dev), vitest 3 (dev) | — | Seed y tests |

Decisiones: Prisma 8 es RC → descartado. NextAuth v4 es `latest` pero su API es de Pages
Router → se usa v5. Next 16 renombró `middleware.ts` a `proxy.ts` (runtime Node.js).

## 3. Arquitectura

```
src/
  proxy.ts                 chequeo optimista de sesión (JWT) y redirecciones
  app/                     rutas: (auth)/login, (dashboard)/*, api/auth/[...nextauth]
  components/ui            shadcn
  components/shared        DataTable, PageHeader, StatCard, MoneyDisplay, StatusBadge,
                           ConfirmDialog, EmptyState, LoadingState, Pagination,
                           SearchInput, DateRangePicker
  components/layout        Sidebar, Topbar, MobileNav, UserMenu
  components/{dashboard,loans,people,payments,finance,reports}
  server/queries           lecturas → DTOs serializables (Decimal → number)
  server/actions           'use server': requireSession + zod + services + revalidatePath
  server/services          operaciones transaccionales (createLoan, registerPayment, ...)
  lib/auth.ts, auth.config.ts, prisma.ts, utils.ts, format.ts, dates.ts
  lib/calculations         puro (decimal.js), sin Prisma, con tests
  lib/validations          esquemas zod compartidos
  hooks/, types/
  generated/prisma         salida del cliente (gitignored)
prisma/schema.prisma, prisma/migrations, prisma/seed.ts, prisma.config.ts
```

Reglas:
- Solo `src/server/**` y `src/lib/prisma.ts` importan Prisma.
- `lib/calculations` no conoce Prisma ni React: recibe y devuelve `Decimal`/strings.
- Lectura: `page.tsx (RSC) → queries → DTO → componentes`.
- Escritura: `form (RHF+zod) → action → service (prisma.$transaction + calculations) → revalidatePath`.
- Toda action/query llama `requireSession()`; el proxy es solo la primera barrera.
- `ActionResult<T> = { success: true; data: T } | { success: false; error: string; fieldErrors?: Record<string,string[]> }`.

## 4. Dinero y fechas

- BD: `Decimal @db.Decimal(15,2)`; tasas `Decimal @db.Decimal(6,3)` (porcentaje, ej. `12.000`).
- Servidor: `decimal.js`, `ROUND_HALF_UP`, 2 decimales. El residuo del reparto de capital
  entre cuotas va a la última cuota (la suma es exacta).
- DTOs: `number` solo para presentación; el cliente nunca calcula.
- Formato COP: `Intl.NumberFormat('es-CO')` → `$1.000.000` (sin decimales, sin espacio).
- Fechas de negocio (`startDate`, `dueDate`, `paymentDate`, `transactionDate`) son
  fecha-solo: `@db.Date` en BD; `yyyy-MM-dd` en DTOs y formularios. "Hoy" se calcula en
  `America/Bogota`.

## 5. Modelo de datos

- `User(id, name, email @unique, passwordHash, createdAt, updatedAt)`
- `Person(id, name, phone?, email?, document? @unique, address?, notes?, active=true, timestamps)` 1—N `Loan`
- `Loan(id, personId, principalAmount, monthlyInterestRate, interestType=SIMPLE,
  numberOfInstallments, installmentFrequency, customIntervalDays?, startDate, dueDate,
  status=ACTIVE, notes?, timestamps)` 1—N `Installment`, 1—N `Payment`
- `Installment(id, loanId, installmentNumber, dueDate, principalAmount, interestAmount,
  totalAmount, principalPaid=0, interestPaid=0, paidAmount=0, status=PENDING, paidAt?)`
  `@@unique([loanId, installmentNumber])`
- `Payment(id, loanId, installmentId?, amount, principalPaid, interestPaid, paymentDate,
  paymentMethod, notes?, createdAt)` 1—N `PaymentAllocation`
- `PaymentAllocation(id, paymentId, installmentId, principalPaid, interestPaid)` —
  detalle exacto de cómo se repartió un pago entre cuotas (un pago puede cubrir varias).
- `Transaction(id, type, category, amount, description, transactionDate, notes?, timestamps)`

Enums: `LoanStatus{ACTIVE,PAID,OVERDUE,CANCELLED}`, `InterestType{SIMPLE}`,
`InstallmentFrequency{MONTHLY,BIWEEKLY,WEEKLY,CUSTOM}`,
`InstallmentStatus{PENDING,PARTIAL,PAID,OVERDUE}`, `PaymentMethod{CASH,BANK_TRANSFER,OTHER}`,
`TransactionType{INCOME,EXPENSE}`,
`TransactionCategory{SALARY,LOAN_INTEREST,OTHER_INCOME,FOOD,TRANSPORT,HOUSING,SERVICES,ENTERTAINMENT,OTHER_EXPENSE}`.

## 6. Reglas financieras (`lib/calculations`)

### 6.1 Interés `SIMPLE` = interés fijo sobre capital inicial (elegido por el usuario)

Para capital `P`, tasa mensual `r` (%), `N` cuotas y frecuencia con `m` meses por
periodo (MONTHLY=1, BIWEEKLY=0.5, WEEKLY=0.25, CUSTOM=días/30):

- `interésPorCuota = P × r/100 × m`
- `capitalPorCuota = P / N` (residuo a la última)
- `totalCuota = capital + interés`; `totalInterés = interésPorCuota × N`
- Fechas: `dueDate_k = startDate + k periodos` (meses con `addMonths`, quincenas 15 días,
  semanas 7 días, CUSTOM `customIntervalDays`). `Loan.dueDate` = fecha de la última cuota
  (editable al crear).

Ejemplo: $1.000.000 al 12 % en 3 cuotas mensuales → 3 × ($333.333 + $120.000);
última cuota $333.334; total interés $360.000.

El cronograma queda fijo al crear el préstamo (modelo "cuotas fijas"). No se
re-amortiza ante abonos extraordinarios; un futuro `InterestType` puede añadir esa
estrategia sin tocar el resto del sistema.

### 6.2 Aplicación de pagos (`Payment.kind`, añadido el 2026-09-19)

El administrador elige a qué se aplica cada pago:

- **AUTO** (`calculatePaymentDistribution`): cuota por cuota desde la objetivo (o la más
  antigua no pagada); en cada una primero el interés pendiente y luego el capital; el
  sobrante pasa a la siguiente. Se rechaza un monto mayor al saldo total.
  Ejemplo del usuario: interés pendiente $120.000 y capital $1.000.000; pago $200.000 →
  $120.000 a interés y $80.000 a capital.
- **INTEREST_ONLY** (`calculateInterestOnlyDistribution`): solo intereses pendientes,
  de la cuota más antigua (u objetivo) en adelante; el capital no cambia. Se rechaza un
  monto mayor a los intereses pendientes.
- **PRINCIPAL** (`calculatePrincipalPrepayment`, abono a capital): el monto se reparte
  en partes iguales como capital pagado de las cuotas pendientes y éstas se recalculan
  como un préstamo nuevo por el saldo restante: capital pendiente en partes iguales e
  interés = nuevo saldo × tasa × meses del periodo. El interés ya cobrado de una cuota
  nunca se reduce. Invariantes: Σ capital de cuotas = capital del préstamo y
  Σ capital pagado de cuotas = Σ capital pagado en pagos. Se rechaza un abono mayor al
  capital pendiente. Con el capital totalmente abonado, el interés restante queda en 0.

### 6.3 Estados

- Cuota: `PAID` si `paidAmount ≥ totalAmount` (fija `paidAt`); `PARTIAL` si
  `0 < paidAmount < totalAmount`; `OVERDUE` si no está pagada y `dueDate < hoy`;
  `PENDING` en otro caso.
- Préstamo: `PAID` si todas las cuotas están pagadas; `OVERDUE` si alguna cuota está
  vencida; `ACTIVE` en otro caso; `CANCELLED` es manual (solo sin pagos registrados).
- No hay cron: `syncOverdueStatuses()` (dos `updateMany` idempotentes) se ejecuta al
  cargar dashboard, préstamos, personas y reportes, y dentro de la transacción de pago.

### 6.4 Métricas

- Capital prestado: Σ `principalAmount` de préstamos ACTIVE+OVERDUE.
- Dinero por cobrar: Σ (`totalAmount − paidAmount`) de cuotas de préstamos ACTIVE+OVERDUE.
- Intereses generados: Σ `interestAmount` de cuotas de préstamos no cancelados.
- Intereses cobrados: Σ `Payment.interestPaid`.
- Ganancias del mes: Σ `Payment.interestPaid` con `paymentDate` en el mes actual.
- Préstamos activos / vencidos: conteo por estado.
- Dinero disponible (caja): Σ ingresos − Σ gastos − Σ capital desembolsado (préstamos no
  cancelados) + Σ pagos recibidos. Los flujos de préstamos NO generan `Transaction`;
  se calculan desde `Loan`/`Payment` para evitar doble conteo.
- Utilidad (reportes): ingresos + intereses cobrados − gastos, en el rango.

## 7. Autenticación y seguridad

- Auth.js v5, provider Credentials (email + password), sesión JWT 7 días, cookie httpOnly.
- `auth.config.ts` (sin Prisma) + `auth.ts` (authorize con Prisma + bcrypt).
- `proxy.ts`: rutas públicas `/login` y `/api/auth/*`; el resto redirige a `/login`;
  `/login` con sesión redirige a `/dashboard`; `/` → `/dashboard`.
- `requireSession()` en cada action/query (lanza/redirige si no hay sesión).
- IDs del cliente se verifican contra la BD dentro de la operación (existencia, relación
  cuota↔préstamo, estado).
- Único usuario admin creado por seed; `/configuracion` permite editar nombre/email y
  cambiar contraseña (verificando la actual).

## 8. Módulos

- **Personas** `/personas`, `/personas/[id]`: tabla + búsqueda (nombre, documento,
  teléfono), crear/editar en Dialog, desactivar/activar; eliminar solo sin préstamos.
  Detalle: datos, totales (prestado, pagado, saldo, intereses generados), préstamos,
  historial de pagos.
- **Préstamos** `/prestamos`, `/prestamos/nuevo`, `/prestamos/[id]`: tabla con filtros por
  estado (query string), formulario con vista previa del cronograma (calculada en el
  servidor vía action de solo lectura), detalle con resumen + tabla de cuotas + pagos +
  botón Registrar pago; cancelar préstamo (sin pagos).
- **Pagos** `/pagos`: tabla de todos los pagos con filtro de fechas y acceso al
  `PaymentDialog` (selección de préstamo, cuota opcional, monto, fecha, método, notas).
- **Finanzas** `/finanzas`: tarjetas del mes, CRUD de transacciones, filtros por fecha y
  categoría, tabla.
- **Dashboard** `/dashboard`: 8 tarjetas, 3 gráficos (últimos 6 meses), próximas cuotas
  (7 días), préstamos vencidos.
- **Reportes** `/reportes`: rango de fechas (por defecto mes actual); resumen y tablas de
  préstamos por estado, intereses generados/cobrados, capital pendiente, ingresos,
  gastos, utilidad.
- **Configuración** `/configuracion`: perfil y contraseña.

## 9. UI

shadcn (Radix, CSS variables), layout con `Sidebar` de shadcn (colapsable, Sheet en
móvil) + Topbar con menú de usuario. Textos en español; identificadores en inglés.
Tablas con estados vacíos y `loading.tsx` con Skeleton por ruta. Toasts con sonner.

## 10. Testing y calidad

- vitest para `lib/calculations` (cronograma, distribución, totales, estados).
- TypeScript strict, sin `any`. `npm run lint`, `npm run build` y `npm test` deben pasar.

## 11. Fases

Se siguen las 12 fases definidas por el usuario. Fase 1 = configuración base sobre el
proyecto existente `capitalia` (se mueve `app/` a `src/app/`).
