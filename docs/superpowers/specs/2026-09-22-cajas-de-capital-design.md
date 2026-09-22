# Capitalia — Cajas de capital (fondos de préstamo)

Fecha: 2026-09-22 · Estado: aprobado por el usuario (secciones 1–3) · Complementa
`2026-09-18-capitalia-design.md` y `2026-09-21-compromisos-financieros-design.md`.

## 1. Objetivo

Saber en todo momento dónde está cada peso del dinero que se presta. El capital deja de ser
un número global y pasa a vivir en **cajas** (fondos) con nombre propio: «Caja José Murillas»,
«Caja Préstamos». Cada caja tiene su saldo, su historia y sus préstamos.

El usuario debe poder responder, sin cálculos manuales:

- cuánto capital disponible tiene cada caja;
- cuánto dinero de cada caja está prestado ahora mismo;
- qué préstamos salieron de cada caja;
- qué dinero se ha retirado de cada caja y hacia dónde;
- el historial completo de movimientos de cada caja, con fecha, concepto y origen o destino.

Regla central: **todo cambio de saldo nace de un movimiento registrado**. No existe forma de
mover el saldo de una caja sin dejar rastro.

## 2. Decisiones tomadas con el usuario

| Tema | Decisión |
|---|---|
| Pagos recibidos | El pago completo (capital + interés) regresa a la caja del préstamo. La caja crece con la ganancia; para usarla se retira explícitamente. |
| Entradas de dinero | Saldo inicial al crear la caja, depósitos de capital (con origen) y traslados entre cajas. |
| Relación con Finanzas | Dos bolsillos separados: Finanzas personales es el efectivo personal; las cajas son el capital de préstamos. El dinero se mueve entre ambos con depósitos y retiros explícitos. |
| Traslados caja ⇄ finanzas | **No** generan movimientos en la tabla de Movimientos; ajustan la fórmula del efectivo personal y quedan en el historial de la caja. |
| Préstamos existentes | La migración crea la caja «General», les asigna todos y reconstruye su historia; después se reasignan libremente. |
| Préstamos nuevos | La caja es obligatoria en el formulario. |
| Enfoque técnico | Libro de movimientos por caja con importes firmados; el saldo es la suma del libro, nunca se almacena. |

## 3. Modelo de datos

### 3.1 Nuevos enums

```prisma
enum CashBoxMovementKind {
  OPENING             // saldo inicial al crear la caja
  DEPOSIT             // aporte de capital
  WITHDRAWAL          // retiro de capital
  TRANSFER_IN         // llegada desde otra caja
  TRANSFER_OUT        // salida hacia otra caja
  LOAN_DISBURSEMENT   // préstamo entregado
  LOAN_PAYMENT        // pago recibido de un préstamo
  LOAN_REVERSAL       // préstamo cancelado o eliminado: el capital regresa
  LOAN_REASSIGNMENT   // el préstamo cambió de caja
  ADJUSTMENT          // corrección manual, con nota obligatoria
}

/// De dónde viene o a dónde va el dinero en un depósito o retiro.
enum CashBoxCounterparty {
  PERSONAL_FINANCES
  EXTERNAL
}
```

### 3.2 `CashBox` (`cash_boxes`)

| Campo | Tipo | Notas |
|---|---|---|
| id | String cuid(2) | |
| name | String @unique | «José Murillas», «Préstamos» |
| description | String? | |
| active | Boolean default true | inactiva = no admite préstamos ni movimientos nuevos |
| createdAt / updatedAt | | |

Relaciones: `movements CashBoxMovement[]`, `loans Loan[]`. Índice `[active, name]`.

### 3.3 `CashBoxMovement` (`cash_box_movements`)

| Campo | Tipo | Notas |
|---|---|---|
| id | String cuid(2) | |
| cashBoxId | String → CashBox (Cascade) | |
| kind | CashBoxMovementKind | |
| amount | Decimal(15,2) | **firmado**: positivo entra, negativo sale |
| movementDate | DateTime @db.Date | fecha real del movimiento (inicio del préstamo, fecha del pago…) |
| description | String | «Préstamo a Juan Pérez», «Aporte de capital» |
| notes | String? | obligatorio en `ADJUSTMENT` (validado en zod) |
| counterparty | CashBoxCounterparty? | solo en `DEPOSIT` / `WITHDRAWAL` |
| relatedCashBoxId | String? | la otra caja en traslados y reasignaciones |
| transferGroupId | String? | une los dos lados de un traslado o reasignación |
| loanId | String? → Loan (SetNull) | |
| paymentId | String? → Payment (SetNull) | |
| createdAt | | |

Índices: `[cashBoxId, movementDate]`, `[loanId]`, `[transferGroupId]`.

El signo vive en `amount`, así que el saldo es una sola agregación y el historial se lee sin
interpretar el tipo. Los tipos que siempre restan (`WITHDRAWAL`, `TRANSFER_OUT`,
`LOAN_DISBURSEMENT`) se guardan negativos; los que siempre suman (`OPENING`, `DEPOSIT`,
`TRANSFER_IN`, `LOAN_PAYMENT`, `LOAN_REVERSAL`), positivos; `ADJUSTMENT` y
`LOAN_REASSIGNMENT` pueden ser de cualquier signo.

### 3.4 `Loan`

Gana `cashBoxId String?` → `CashBox` con `onDelete: Restrict` (no se elimina una caja con
préstamos) e índice `[cashBoxId]`. Opcional en la base de datos para tolerar préstamos
históricos sin caja; **obligatorio en el formulario** (`loanSchema`).

### 3.5 Derivados (nunca almacenados)

Por caja:

- **Disponible** = Σ `amount` de sus movimientos.
- **Prestado** = Σ (`principalAmount` − Σ `principalPaid` de sus cuotas) de sus préstamos no
  cancelados.
- **Total de la caja** = disponible + prestado.
- **Intereses generados** = Σ `interestPaid` de los pagos de sus préstamos.

## 4. Reglas de movimiento

Toda operación corre dentro de `prisma.$transaction`: se registran juntos el movimiento y su
efecto, o no pasa nada.

### 4.1 Crear préstamo

Precondiciones: la caja existe, está activa y su **disponible ≥ monto**. Si no,
`ServiceError` con el campo marcado: «La caja {nombre} solo tiene {disponible} disponibles».

Efecto: se crea el préstamo con su cronograma (sin cambios respecto al comportamiento actual)
y un `LOAN_DISBURSEMENT` de **−monto**, fechado en `startDate`, descripción
«Préstamo a {persona}», con `loanId`.

### 4.2 Registrar pago

Efecto: `LOAN_PAYMENT` de **+monto completo** (capital + interés) en la caja del préstamo,
fechado en `paymentDate`, descripción «Pago de {persona}», con `loanId` y `paymentId`. El
desglose capital/interés se consulta por el pago enlazado.

Si el préstamo no tiene caja, el pago se registra igual y ninguna caja cambia.

### 4.3 Cancelar o eliminar préstamo

Ambas operaciones ya exigen que el préstamo no tenga pagos, así que el capital vuelve entero:
`LOAN_REVERSAL` de **+capital**, fechado hoy, descripción «Préstamo cancelado — {persona}» o
«Préstamo eliminado — {persona}».

### 4.4 Reasignar un préstamo a otra caja

Neto que ese préstamo movió en su caja actual: `neto = capital − Σ pagos recibidos`.

Se crean dos `LOAN_REASSIGNMENT` unidos por `transferGroupId`, misma fecha (hoy) y concepto
«Reasignación del préstamo de {persona}»: **+neto** en la caja anterior (se le devuelve lo que
puso) y **−neto** en la nueva. Los movimientos originales permanecen donde ocurrieron: el
dinero efectivamente pasó por esa caja y el reverso documenta la corrección.

Precondiciones: la caja destino existe, está activa, es distinta de la actual y —si `neto > 0`—
tiene disponible suficiente.

### 4.5 Depósito y retiro

- **Depósito**: `DEPOSIT` de **+monto** con `counterparty` = `PERSONAL_FINANCES` (sale de tu
  efectivo personal) o `EXTERNAL` (tu bolsillo, un socio, otra fuente).
- **Retiro**: `WITHDRAWAL` de **−monto** con `counterparty` = `PERSONAL_FINANCES` (entra a tu
  efectivo personal) o `EXTERNAL` (sale del sistema). Valida disponible suficiente.

Ambos llevan fecha, descripción y notas opcionales.

### 4.6 Traslado entre cajas

`TRANSFER_OUT` (**−monto**) en el origen y `TRANSFER_IN` (**+monto**) en el destino, unidos por
`transferGroupId`, con la misma fecha y concepto y `relatedCashBoxId` cruzado. Valida
disponible suficiente y origen ≠ destino.

### 4.7 Ajuste

`ADJUSTMENT` con importe positivo o negativo y **nota obligatoria**. Existe para cuadrar
diferencias reales (un billete perdido, un error de digitación antiguo) sin disfrazarlas de
depósito.

## 5. Efectivo personal y patrimonio

`getCashPosition` cambia de fórmula:

```
antes:  Σ ingresos − Σ gastos − Σ capital prestado (no cancelados) + Σ pagos recibidos
ahora:  Σ ingresos − Σ gastos − Σ depósitos con counterparty PERSONAL_FINANCES
                              + Σ retiros con counterparty PERSONAL_FINANCES
```

Los flujos de préstamos salen del efectivo personal porque ahora viven en las cajas. Se añaden
tres métricas:

- **Capital en cajas** = Σ disponibles de las cajas activas.
- **Prestado** = Σ pendiente de capital de los préstamos no cancelados.
- **Patrimonio total** = efectivo personal + capital en cajas + prestado.

Los traslados entre caja y finanzas **no** crean `Transaction`, de modo que un aporte de
capital no aparece como un gasto que distorsione el balance del mes ni los reportes.

Consumidores a actualizar: `CashPosition` (`src/server/queries/cash.ts`), «Dinero disponible»
en `/finanzas` y `/finanzas/movimientos`, `cashAvailable` en
`src/server/queries/commitments.ts` y la tarjeta del Dashboard. La utilidad de `/reportes`
(`ingresos + intereses cobrados − gastos`) no cambia: nunca restó capital desembolsado.

## 6. Capa servidor

- `src/lib/calculations/cash-boxes.ts` (puro, con tests): `cashBoxBalance(movements)`,
  `outstandingPrincipal(loans)`, `reassignmentNet(principal, paymentsReceived)`,
  `runningBalance(movements)` (saldo corrido para el historial),
  `signedAmount(kind, amount)` (normaliza el signo al escribir).
- `src/lib/validations/cash-box.ts`: `cashBoxSchema`, `depositSchema`, `withdrawalSchema`,
  `transferSchema`, `adjustmentSchema`, `reassignLoanSchema`. `loanSchema` gana
  `cashBoxId: idSchema`.
- `src/server/queries/cash-boxes.ts`: `listCashBoxes`, `listCashBoxOptions` (activas, con
  disponible para el formulario de préstamo), `getCashBoxDetail` (métricas + préstamos +
  historial con saldo corrido), `getCashBoxesSummary`.
- `src/server/services/cash-boxes.ts`: CRUD + `deposit`, `withdraw`, `transfer`, `adjust`, y
  las funciones que consumen préstamos y pagos: `recordLoanDisbursement`,
  `recordLoanPayment`, `recordLoanReversal`, `reassignLoan`. Todas aceptan el cliente
  transaccional (`tx`) para ejecutarse dentro de la transacción de quien las llama.
- `src/server/actions/cash-boxes.ts`; `src/server/actions/loans.ts` gana
  `reassignLoanCashBoxAction`.
- `revalidateFinance()` se extiende con `/prestamos/cajas`.

Se mantienen las reglas del proyecto: solo `src/server/**` importa Prisma, los cálculos son
puros, el dinero viaja como `Decimal` en el servidor y como `number` en los DTO, y toda
query/action llama `requireSession()`.

## 7. Pantallas

**`/prestamos/cajas`** — se llega con un botón «Cajas» en el encabezado de Préstamos. Cuatro
tarjetas de resumen (Capital total, Disponible para prestar, Prestado, Intereses generados) y
una tarjeta por caja con nombre, disponible, prestado, total, número de préstamos activos y un
menú: Depositar · Retirar · Trasladar · Ver detalle · Editar · Desactivar · Eliminar. Eliminar
solo es posible sin préstamos y sin movimientos distintos de la apertura; en otro caso se
sugiere desactivar. Estado vacío que invita a crear la primera caja.

**`/prestamos/cajas/[id]`** — detalle con la misma tarjeta y sus acciones, la lista de
préstamos de la caja (persona, capital, pendiente, estado, enlace) y el historial completo:
tabla con filtro por tipo y rango de fechas, columnas fecha, tipo (badge con tono por signo),
descripción, contraparte o caja relacionada, enlace al préstamo o pago, importe firmado y
**saldo corrido**. Versión en tarjetas para móvil.

**Formulario de préstamo** — campo **Caja** obligatorio, antes del monto, mostrando el
disponible de cada opción («José Murillas — $3.000.000 disponibles»). El error por saldo
insuficiente se muestra bajo el monto.

**Lista de préstamos** — columna *Caja* (oculta bajo `lg`) y filtro por caja en la URL junto al
de estado. **Detalle de préstamo** — la caja aparece en el resumen con la acción **Cambiar
caja**, que muestra el movimiento neto antes de confirmar.

**Finanzas y Dashboard** — se actualiza el texto de «Dinero disponible» (ahora efectivo
personal) y el Dashboard gana una tarjeta **Capital en cajas** con el desglose
disponible/prestado.

Textos en español; identificadores en inglés; `loading.tsx` con skeleton en cada ruta nueva.

## 8. Errores y reglas de integridad

- Préstamo mayor que el disponible de la caja → error de campo en el monto.
- Retiro o traslado mayor que el disponible → error de campo en el monto.
- Traslado con origen = destino → error.
- Caja inactiva en préstamo, depósito, retiro o traslado → error.
- Nombre de caja duplicado → error de campo (`@unique` + `P2002`).
- Eliminar caja con préstamos o movimientos → `ServiceError` que sugiere desactivar.
- Desactivar una caja con préstamos activos se permite: conserva su historia y deja de
  ofrecerse para préstamos nuevos.
- `ADJUSTMENT` sin nota → error de campo.

## 9. Migración y datos

Migración `add_cash_boxes`: enums nuevos, tablas `cash_boxes` y `cash_box_movements`,
`Loan.cashBoxId`.

**Backfill** (script idempotente ejecutado una vez, `prisma/backfill-cash-boxes.ts`): si no
existe ninguna caja, crea **General** y le asigna **todos** los préstamos sin caja, incluidos
los cancelados, para que la pregunta «qué préstamos salieron de esta caja» tenga respuesta
completa. Reconstruye la historia solo de los préstamos **no cancelados** (un préstamo
cancelado nunca movió dinero, porque cancelar exige que no tenga pagos): un
`LOAN_DISBURSEMENT` por préstamo con fecha de inicio y un `LOAN_PAYMENT` por cada pago con su
fecha, más un `OPENING` igual al capital total de esos préstamos, de modo que el disponible
resultante sea exactamente lo ya devuelto. El usuario ajusta después con un depósito si tenía
más capital ocioso. Volver a ejecutarlo no duplica nada: se detiene si ya existe alguna caja.

`db:seed` crea dos cajas de ejemplo («José Murillas» con $3.000.000 y «Préstamos» con
$2.500.000), reparte entre ellas los préstamos de ejemplo y registra sus desembolsos y pagos.
`db:clear` borra cajas y movimientos junto al resto de datos de negocio (los préstamos primero,
por la FK `Restrict`).

## 10. Pruebas

- Vitest (`src/lib/calculations/cash-boxes.test.ts`): saldo con importes firmados, capital
  pendiente por caja, neto de reasignación (con y sin pagos), saldo corrido en orden
  cronológico, normalización de signo por tipo.
- Playwright (`e2e/cash-boxes.spec.ts`): crear caja → depositar → prestar desde ella (baja el
  disponible) → registrar pago (sube) → retirar hacia finanzas → reasignar el préstamo a otra
  caja y comprobar ambos saldos.
- Los e2e existentes de préstamos se actualizan para elegir caja en el formulario.
- `npm run lint && npm run typecheck && npm test` verdes al cerrar cada fase.

## 11. Fases de implementación

1. Esquema, migración y backfill de la caja «General».
2. Cálculos puros y sus pruebas.
3. Cajas de punta a punta: validaciones, queries, servicios, acciones, lista y detalle.
4. Integración con préstamos y pagos: caja obligatoria, validación de saldo, desembolso,
   pago, reverso y reasignación.
5. UI restante: filtros y columna en la lista, detalle del préstamo, cambio de fórmula del
   efectivo personal, tarjeta del Dashboard, seed y e2e.

Cada fase deja la aplicación compilando y usable. No se hacen commits salvo indicación expresa
del usuario.
