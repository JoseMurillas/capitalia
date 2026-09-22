# Capitalia — Compromisos financieros (recurrentes y tarjetas de crédito)

Fecha: 2026-09-21 · Estado: aprobado por el usuario (secciones 1–4) · Complementa
`2026-09-18-capitalia-design.md`.

## 1. Objetivo

Que Finanzas personales sirva para planificar y no solo para registrar el pasado. El usuario
debe poder saber: cuánto tiene comprometido cada mes, qué pagos se acercan, cuánto debe pagar
de cada tarjeta, cuánto cupo le queda y qué porcentaje usa, cuánto necesita reservar y qué
pagos vienen en las próximas semanas. Las alertas se muestran dentro de la app antes del
vencimiento.

Regla central: **el cupo de una tarjeta de crédito nunca es dinero disponible ni ingreso**. Las
tarjetas son una obligación que se planifica; ninguna consulta de caja (`getCashPosition`) lee
`CreditCard`.

## 2. Decisiones tomadas con el usuario

| Tema | Decisión |
|---|---|
| Marcar recurrente pagado | Crea automáticamente el gasto (`Transaction EXPENSE`) con el monto real y avanza la próxima fecha según la frecuencia. |
| Detalle de tarjetas | Saldos manuales desde el extracto (saldo, mínimo, pago planeado, fechas) + compras diferidas (cuotas) + historial de movimientos. No se registra cada compra. |
| Recurrente pagado con tarjeta | No crea gasto de caja: crea un cargo y suma al saldo de la tarjeta. El dinero sale de caja al pagar la tarjeta. |
| Navegación | Sub-rutas de Finanzas con navegación secundaria: `/finanzas` (Resumen), `/finanzas/movimientos`, `/finanzas/recurrentes`, `/finanzas/tarjetas`, `/finanzas/tarjetas/[id]`, `/finanzas/bandeja`. |
| Días de aviso | Campo por cada recurrente y tarjeta; el valor por defecto de los nuevos registros se configura en Configuración (`default_reminder_days`, inicial 3). |
| Canal de alertas | Solo en la app (Resumen y Dashboard). Sin cron ni correo; se calcula al cargar la página. |
| Enfoque | "Planificador con próxima fecha almacenada" (no se generan ocurrencias futuras). |

## 3. Modelo de datos

### 3.1 Enum `TransactionCategory` ampliado

Se añaden categorías de gasto (migración `ALTER TYPE ... ADD VALUE`):
`SUBSCRIPTIONS`, `INSURANCE`, `HEALTH`, `EDUCATION`, `DEBT`, `CREDIT_CARD_PAYMENT`.

- Los gastos recurrentes usan estas mismas categorías de gasto (sin mapeos). El resumen
  "Suscripciones / Servicios / Deudas / …" sale de agrupar por categoría.
- `EXPENSE_CATEGORIES`, `TRANSACTION_CATEGORY_LABELS` y `guessCategory` se actualizan
  (`netflix|spotify|disney|hbo|prime|youtube|icloud|google one` → `SUBSCRIPTIONS`; `seguro|sura|
  poliza` → `INSURANCE`; `eps|medicina|farmacia|gimnasio|gym|smart fit|bodytech` → `HEALTH`;
  `colegio|universidad|matricula|curso` → `EDUCATION`; `credito|prestamo|cuota` → `DEBT`).
  `ENTERTAINMENT` conserva cine/teatro/bar/juegos.
- `CREDIT_CARD_PAYMENT` se ofrece en el formulario de movimientos como cualquier otra categoría
  de gasto, pero normalmente la crea el sistema al registrar un pago de tarjeta.

### 3.2 Nuevos enums

```
RecurringFrequency     { WEEKLY, BIWEEKLY, MONTHLY, QUARTERLY, SEMIANNUAL, ANNUAL, CUSTOM }
RecurringPaymentMethod { CASH, BANK_TRANSFER, CREDIT_CARD, OTHER }
CreditCardMovementKind { CHARGE, PAYMENT, ADJUSTMENT }
```

### 3.3 Modelos

**`RecurringExpense`** (`recurring_expenses`)

| Campo | Tipo | Notas |
|---|---|---|
| id | String cuid(2) | |
| name | String | "Internet", "Netflix" |
| category | TransactionCategory | solo categorías de gasto (validado en zod) |
| amount | Decimal(15,2) | valor esperado; si `isVariable`, es un estimado |
| isVariable | Boolean default false | |
| frequency | RecurringFrequency | |
| customIntervalDays | Int? | obligatorio si `CUSTOM` (1–365) |
| nextDueDate | Date | próxima fecha de pago |
| paymentMethod | RecurringPaymentMethod | |
| creditCardId | String? → CreditCard (Restrict) | obligatorio si `CREDIT_CARD` |
| reminderDays | Int | 0–60; default tomado de `default_reminder_days` al crear |
| lastPaidDate | Date? | fecha del último "marcar pagado" |
| active | Boolean default true | pausado = false |
| notes | String? | |
| createdAt / updatedAt | | |

Índices: `[active, nextDueDate]`, `[creditCardId]`.

**`Transaction`** gana `recurringExpenseId String?` → `RecurringExpense` (`onDelete: SetNull`),
índice `[recurringExpenseId]`. Permite el historial de pagos de un recurrente y mostrar "pagado
el …".

**`CreditCard`** (`credit_cards`)

| Campo | Tipo | Notas |
|---|---|---|
| id | String cuid(2) | |
| name | String | "Visa Bancolombia" |
| creditLimit | Decimal(15,2) | cupo total (> 0) |
| balance | Decimal(15,2) default 0 | saldo pendiente = cupo utilizado; puede superar el cupo (se muestra en rojo) |
| minimumPayment | Decimal(15,2)? | del extracto |
| paymentAmount | Decimal(15,2)? | lo que se planea pagar este ciclo; `null` = usar el mínimo |
| nextClosingDate | Date | próxima fecha de corte |
| nextPaymentDate | Date | próxima fecha límite de pago |
| reminderDays | Int | 0–60; default global |
| active | Boolean default true | |
| notes | String? | |
| createdAt / updatedAt | | |

Derivados (no almacenados): `available = max(creditLimit − balance, 0)`,
`utilization = creditLimit > 0 ? balance / creditLimit : 0`, `suggestedPayment = paymentAmount ??
minimumPayment ?? 0`, `installmentsThisMonth = Σ installmentAmount` de planes activos.

**`CreditCardInstallmentPlan`** (`credit_card_installment_plans`) — compras diferidas

| Campo | Tipo | Notas |
|---|---|---|
| id, creditCardId (Cascade) | | |
| description | String | "Televisor" |
| totalAmount | Decimal(15,2) | |
| installmentAmount | Decimal(15,2) | valor de cada cuota, digitado (el banco suma intereses) |
| installments | Int (1–120) | número de cuotas |
| paidInstallments | Int default 0 | ≤ installments |
| startDate | Date | |
| notes | String? | |
| createdAt / updatedAt | | |

Derivados: `remainingInstallments = installments − paidInstallments`,
`remainingAmount = remainingInstallments × installmentAmount`, `finished = remaining = 0`.

**`CreditCardMovement`** (`credit_card_movements`) — historial

| Campo | Tipo | Notas |
|---|---|---|
| id, creditCardId (Cascade) | | |
| kind | CreditCardMovementKind | CHARGE suma al saldo, PAYMENT resta, ADJUSTMENT ± (diferencia al actualizar extracto) |
| amount | Decimal(15,2) | siempre positivo salvo ADJUSTMENT, que puede ser negativo |
| movementDate | Date | |
| description | String | |
| recurringExpenseId | String? (SetNull) | cargo originado por un recurrente |
| transactionId | String? @unique (SetNull) | gasto creado al registrar un pago |
| createdAt | | |

Índices: `[creditCardId, movementDate]`.

**`AppSetting`**: clave `default_reminder_days` (string numérico, inicial `3`, rango 0–60).

## 4. Reglas de cálculo (`src/lib/calculations/recurring.ts`, `credit-cards.ts`, `commitments.ts`)

Puras: reciben `Decimal`/`IsoDate`, no conocen Prisma ni React; cubiertas por Vitest.

### 4.1 Equivalente mensual (`monthlyEquivalent`)

| Frecuencia | Factor sobre `amount` |
|---|---|
| WEEKLY | × 52 / 12 |
| BIWEEKLY | × 2 |
| MONTHLY | × 1 |
| QUARTERLY | ÷ 3 |
| SEMIANNUAL | ÷ 6 |
| ANNUAL | ÷ 12 |
| CUSTOM | × 30 / customIntervalDays |

Resultado con `roundMoney` (2 decimales, half-up). Solo recurrentes activos.

### 4.2 Avance de fecha (`advanceDueDate(nextDueDate, frequency, customDays)`)

Parte de la fecha programada, no de hoy, para conservar la cadencia. `WEEKLY +7 días`,
`BIWEEKLY +15 días` (misma convención que los préstamos), `MONTHLY +1 mes`, `QUARTERLY +3`,
`SEMIANNUAL +6`, `ANNUAL +12` (con `addMonths`: 31 ene → 28/29 feb), `CUSTOM +N días`.
Se avanza **una sola vez**; si el usuario dejó pasar más de un ciclo, corrige la fecha al editar.

### 4.3 Estado de un compromiso (`commitmentStatus(today, dueDate, reminderDays)`)

Con `daysUntilDue = daysBetweenIso(today, dueDate)`:

| Estado | Condición | Presentación |
|---|---|---|
| `OVERDUE` | `daysUntilDue < 0` | rojo, "Venció hace N días" |
| `DUE_TODAY` | `= 0` | rojo, "Vence hoy" |
| `ALERT` | `0 < daysUntilDue ≤ reminderDays` | ámbar, "Vence en N días" — **alerta activa** |
| `UPCOMING` | resto | neutro, "En N días" |

Las alertas activas son los compromisos en `OVERDUE`, `DUE_TODAY` o `ALERT`.

### 4.4 Plan del mes (`buildMonthPlan`)

Entradas: `today`, `monthIncome`, `monthExpense` (ya calculados por `getFinanceSummary`),
recurrentes activos, tarjetas activas.

- `recurringPending` = Σ `amount` de recurrentes activos con `nextDueDate ≤ fin de mes` y
  `paymentMethod ≠ CREDIT_CARD` (incluye vencidos). Los pagados con tarjeta no salen de caja;
  se reflejan cuando se paga la tarjeta.
- `cardPending` = Σ `suggestedPayment` de tarjetas activas con `nextPaymentDate ≤ fin de mes`.
- `reserveNeeded = recurringPending + cardPending`.
- `estimatedAvailable = monthIncome − monthExpense − reserveNeeded`. Lo ya pagado este mes
  está en `monthExpense`, así que no se resta dos veces.
- `monthlyCommitted` = Σ equivalente mensual de todos los recurrentes activos (informativo,
  independiente del mes).
- `byCategory` = equivalente mensual agrupado por categoría, ordenado de mayor a menor.

### 4.5 Próximos compromisos (`listUpcomingCommitments(today, horizonDays)`)

Unifica recurrentes activos y tarjetas activas en `Commitment { kind: "RECURRING" | "CARD",
id, name, category?, amount, dueDate, daysUntilDue, status, paymentMethod?, cardName? }`,
con `dueDate ≤ today + horizonDays` **o** vencidos, ordenados por `dueDate` asc. Horizonte:
30 días en Resumen, 14 en Dashboard. Total al pie = Σ `amount`.

## 5. Operaciones (services, transaccionales)

### 5.1 Marcar recurrente pagado (`markRecurringPaid(id, { amount, paidDate })`)

Precondiciones: existe y `active`; si `paymentMethod = CREDIT_CARD`, la tarjeta existe y está
activa. `amount` prellenado con `amount` del recurrente; editable siempre, destacado si
`isVariable`.

1. Si método ≠ `CREDIT_CARD`: `createTransaction({ type: EXPENSE, category, amount, description:
   name, transactionDate: paidDate, recurringExpenseId }, db)`.
2. Si método = `CREDIT_CARD`: `CreditCardMovement CHARGE` (description = name,
   `recurringExpenseId`) y `CreditCard.balance += amount`.
3. `nextDueDate = advanceDueDate(...)`, `lastPaidDate = paidDate`.

### 5.2 Registrar pago de tarjeta (`registerCardPayment(id, { amount, paidDate, notes, advanceCycle })`)

`advanceCycle` por defecto `true`. No lleva método de pago: `Transaction` no lo almacena (solo
los pagos de préstamos lo tienen).

1. `createTransaction({ type: EXPENSE, category: CREDIT_CARD_PAYMENT, amount, description:
   "Pago tarjeta {name}", transactionDate: paidDate, notes }, db)`.
2. `CreditCardMovement PAYMENT` con `transactionId`.
3. `balance = max(balance − amount, 0)`. Si `amount > balance` el diálogo avisa; se permite.
4. Si `advanceCycle`: `nextClosingDate += 1 mes`, `nextPaymentDate += 1 mes`,
   `paymentAmount = null`, y cada plan con `paidInstallments < installments` suma 1.

### 5.3 Actualizar extracto (`updateCardStatement(id, { balance, minimumPayment, paymentAmount, nextClosingDate, nextPaymentDate })`)

Si `balance` cambia, registra `CreditCardMovement ADJUSTMENT` por la diferencia (puede ser
negativa) con descripción "Ajuste por extracto".

### 5.4 CRUD

- Recurrentes: crear, editar, pausar/activar (`active`), eliminar (las `Transaction` quedan con
  `recurringExpenseId = null`).
- Tarjetas: crear, editar (nombre, cupo, fechas, reminderDays, notas), desactivar/activar,
  eliminar solo si no tiene movimientos ni recurrentes enlazados (`ServiceError` claro; se sugiere
  desactivar).
- Compras diferidas: crear, editar, eliminar (sin efecto sobre el saldo: es informativo).
- Un `Transaction` de pago de tarjeta eliminado desde Movimientos **no** revierte el saldo; el
  diálogo de eliminación lo advierte cuando la transacción está enlazada a un movimiento de
  tarjeta.

### 5.5 Errores

- Marcar pagado un recurrente pausado → "El gasto está pausado".
- Recurrente con tarjeta inactiva → "La tarjeta {name} está inactiva".
- `customIntervalDays` faltante con `CUSTOM`, `creditCardId` faltante con `CREDIT_CARD`,
  `paidInstallments > installments`, categoría de ingreso en un recurrente → errores de campo zod.

## 6. Capa servidor

Mismo patrón que `transactions`: `page.tsx (RSC) → queries → DTO → componentes` y
`form → action → service → revalidatePath`.

- `src/lib/validations/recurring.ts`: `RECURRING_FREQUENCIES`, `RECURRING_PAYMENT_METHODS`,
  `recurringExpenseSchema`, `markRecurringPaidSchema`.
- `src/lib/validations/credit-card.ts`: `creditCardSchema`, `creditCardStatementSchema`,
  `creditCardPaymentSchema`, `installmentPlanSchema`.
- `src/server/queries/recurring.ts`: `listRecurringExpenses({ status, category })`,
  `getRecurringExpense(id)`, `getRecurringSummary()`.
- `src/server/queries/credit-cards.ts`: `listCreditCards()`, `getCreditCard(id)` (con planes y
  movimientos), `getCreditCardsSummary()`.
- `src/server/queries/commitments.ts`: `getCommitmentsOverview()` (plan del mes + alertas +
  próximos 30 días) y `getUpcomingCommitments(days)` para el Dashboard.
- `src/server/services/recurring.ts`, `credit-cards.ts`.
- `src/server/actions/recurring.ts`, `credit-cards.ts`, y `settings.ts` gana
  `updateReminderDefaultAction`.
- `revalidateFinance()` (compartido) revalida `/finanzas`, `/finanzas/movimientos`,
  `/finanzas/recurrentes`, `/finanzas/tarjetas`, `/dashboard`, `/reportes`; las acciones de
  tarjeta además `/finanzas/tarjetas/[id]`.
- `src/lib/labels.ts`: `RECURRING_FREQUENCY_LABELS`, `RECURRING_PAYMENT_METHOD_LABELS`,
  `CARD_MOVEMENT_KIND_LABELS`, `COMMITMENT_STATUS_LABELS`, nuevas categorías.

## 7. Pantallas

**Navegación secundaria** `FinanceNav` (`src/components/finance/finance-nav.tsx`, cliente con
`usePathname`; recibe `pendingInbox`): Resumen · Movimientos · Recurrentes · Tarjetas · Bandeja
(badge). Se renderiza bajo el `PageHeader` de cada página de Finanzas; fila desplazable en móvil.

**`/finanzas` — Resumen**
1. `CommitmentAlerts`: solo si hay alertas activas; lista con tono por estado y botón "Pagar"
   que abre el diálogo correspondiente (marcar pagado / pago de tarjeta).
2. Tarjetas del mes (`StatCard`, grid 2×4): Ingresos · Gastos · Recurrentes pendientes · Pagos
   de tarjetas · Disponible estimado (hint "ingresos − gastos − compromisos pendientes") ·
   Reserva necesaria · Dinero disponible (caja, fórmula actual) · Comprometido mensual.
3. `UpcomingCommitments` (30 días): nombre, badge Recurrente/Tarjeta, fecha, "en N días",
   monto, total al pie.
4. `RecurringByCategory`: categoría → equivalente mensual, total.
5. `CreditCardsMini`: por tarjeta, barra de utilización, disponible, próximo pago y fecha.

**`/finanzas/movimientos`** — la página actual movida de ruta, sin cambios funcionales
(conserva filtros por URL `from/to/type/category/page`).

**`/finanzas/recurrentes`** — encabezado con "Nuevo gasto recurrente"; resumen (total mensual +
chips por categoría); filtros URL `status=active|paused|all` (default `active`) y `category`;
`DataTable`/`MobileCard` con Nombre · Categoría · Frecuencia · Próximo pago (+ badge estado) ·
Método (nombre de la tarjeta si TC) · Valor (etiqueta "variable") · acciones (Marcar pagado,
Editar, Pausar/Activar, Eliminar). Diálogos: `RecurringFormDialog`, `MarkPaidDialog` (monto,
fecha, aviso "Se registrará un gasto en Finanzas" / "Se cargará a la tarjeta X").

**`/finanzas/tarjetas`** — encabezado con "Nueva tarjeta"; totales (deuda total, cupo
disponible total, pagos del mes); una `CreditCardCard` por tarjeta con utilización (barra + %),
cupo/utilizado/disponible, corte, fecha límite (estado), mínimo, pago planeado, cuotas del mes
y acciones (Registrar pago, Actualizar extracto, Ver detalle, Editar, Desactivar/Eliminar).
Diálogos: `CreditCardFormDialog`, `CardPaymentDialog`, `CardStatementDialog`.

**`/finanzas/tarjetas/[id]`** — detalle: mismos datos + tabla de compras diferidas (crear,
editar, eliminar; cuota, pagadas/total, saldo restante) + historial de movimientos (tipo, fecha,
descripción, monto, enlace al gasto si existe). `InstallmentPlanDialog`.

**Dashboard** — nueva card `UpcomingCommitmentsCard` (14 días) junto a "Próximos pagos" de
préstamos. Las métricas existentes no cambian.

**Configuración** — card "Alertas de compromisos" con "Días de aviso por defecto" (número
0–60, atajos 1/3/5/7).

`loading.tsx` con Skeleton en cada ruta nueva. Textos en español; identificadores en inglés.

## 8. Pruebas

- Vitest: `recurring.test.ts` (equivalente mensual por frecuencia; avance de fecha incl.
  31 ene → 28 feb, quincenal +15, custom), `commitments.test.ts` (estado por `reminderDays`,
  plan del mes: excluye TC, incluye vencidos, `paymentAmount ?? minimumPayment ?? 0`, unión y
  orden de próximos), `credit-cards.test.ts` (utilización, disponible, cuotas del mes, saldo
  restante de planes).
- Playwright: actualizar `smoke`, `inbox` y `mobile` a `/finanzas/movimientos`; nuevo
  `commitments.spec.ts` (crear recurrente → marcar pagado → gasto visible y fecha avanzada; crear
  tarjeta → registrar pago → saldo reducido y gasto `CREDIT_CARD_PAYMENT` visible).
- `npm run lint && npm run typecheck && npm test` verdes al cerrar cada fase.

## 9. Seed y migración

- Migración `add_financial_commitments`: enum ampliado, enums nuevos, tablas nuevas,
  `Transaction.recurringExpenseId`, índices.
- `db:seed` añade: arriendo (mensual, transferencia), internet (mensual, transferencia),
  Netflix (mensual, TC), seguro (anual), gimnasio (mensual, efectivo), cuota vehículo (mensual,
  DEBT); dos tarjetas con saldos, fechas y una compra diferida cada una; `default_reminder_days`
  se crea al vuelo si falta (lectura con default 3).
- `db:clear` también borra recurrentes, tarjetas, planes y movimientos.

## 10. Fases de implementación

1. Migración + enums + labels + `guessCategory` + `EXPENSE_CATEGORIES`.
2. Cálculos puros + tests.
3. Recurrentes end-to-end (validaciones, queries, services, actions, página, diálogos).
4. Tarjetas end-to-end (lista, detalle, compras diferidas, extracto, pago).
5. `FinanceNav`, mover Movimientos, Resumen, card en Dashboard, Configuración, seed, e2e.

Cada fase deja la app compilando y usable. No se hacen commits salvo indicación expresa del
usuario.
