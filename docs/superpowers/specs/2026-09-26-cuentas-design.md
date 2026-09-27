# Capitalia — Cuentas: dónde está la plata

Fecha: 2026-09-26 · Estado: aprobado por el usuario · Complementa `2026-09-18-capitalia-design.md`.

## 1. Objetivo

Saber cuánto hay **en cada sitio** donde tienes dinero —la tarjeta débito, los ahorros, el
efectivo, la billetera— en vez de un solo número global. Cada movimiento de Finanzas dice de qué
cuenta salió o a cuál entró, y el saldo de una cuenta es la suma de lo que pasó por ella.

Hoy `Transaction` no tiene cuenta y «Disponible» es una fórmula global
(ingresos − gastos − depósitos a cajas + retiros), calculada en
`src/lib/calculations/commitments.ts`. Por eso la app no puede decir «tienes $180.000 en
efectivo».

## 2. Decisiones tomadas con el usuario

| Tema | Decisión |
|---|---|
| Modelo | Cada movimiento sale de una cuenta. El saldo es la suma de sus movimientos, nunca un campo guardado. |
| Tipos | Débito, Ahorros, Efectivo y Billetera digital (Nequi, Daviplata, Dale). Varias de cada tipo. |
| Cajas de capital | Separadas pero conectadas: depositar o retirar de una caja elige cuenta, y deja rastro en ambos lados. No se rehace el módulo de cajas. |
| Los 67 movimientos existentes | Quedan **sin cuenta**. El usuario los asigna a mano desde un filtro «Sin cuenta». Mientras queden, la pantalla avisa que los saldos están incompletos. |
| Pagos de deudores | No cambian: siguen entrando a la caja de capital, que es donde vive ese dinero. |

## 3. Modelo de datos

### 3.1 La cuenta

```prisma
enum AccountKind {
  DEBIT    /// Tarjeta débito
  SAVINGS  /// Cuenta de ahorros
  CASH     /// Dinero físico
  WALLET   /// Billetera digital: Nequi, Daviplata, Dale
}

model Account {
  id        String      @id @default(cuid(2))
  name      String
  kind      AccountKind
  /// Banco o proveedor, texto libre: "Bancolombia", "Dale".
  issuer    String?
  /// Últimos cuatro dígitos, cuando es una tarjeta.
  last4     String?
  active    Boolean     @default(true)
  notes     String?
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  movements    AccountMovement[]
  transactions Transaction[]

  @@index([active, name])
  @@map("accounts")
}
```

### 3.2 Los movimientos que no son de Finanzas

```prisma
enum AccountMovementKind {
  OPENING    /// Saldo inicial al crear la cuenta
  TRANSFER   /// Entre dos cuentas propias
  CASH_BOX   /// Depósito o retiro de una caja de capital
  ADJUSTMENT /// Corrección manual
}

model AccountMovement {
  id           String              @id @default(cuid(2))
  accountId    String
  account      Account             @relation(fields: [accountId], references: [id], onDelete: Cascade)
  kind         AccountMovementKind
  /// Con signo: negativo saca dinero de la cuenta.
  amount       Decimal             @db.Decimal(15, 2)
  movementDate DateTime            @db.Date
  description  String
  notes        String?
  /// El movimiento de caja que este refleja, para poder ir de un libro al otro.
  cashBoxMovementId String?        @unique
  cashBoxMovement   CashBoxMovement? @relation(fields: [cashBoxMovementId], references: [id], onDelete: SetNull)
  /// Las dos patas de una transferencia comparten este valor.
  transferGroupId String?
  createdAt    DateTime            @default(now())

  @@index([accountId, movementDate])
  @@index([transferGroupId])
  @@map("account_movements")
}
```

### 3.3 El enganche en Finanzas

```prisma
model Transaction {
  // …lo que ya hay…
  /// Dónde entró o de dónde salió. Null en los movimientos anteriores a las cuentas.
  accountId String?
  account   Account? @relation(fields: [accountId], references: [id], onDelete: SetNull)

  @@index([accountId, transactionDate])
}
```

`CashBoxMovement` gana el lado espejo:

```prisma
model CashBoxMovement {
  // …lo que ya hay…
  accountMovement AccountMovement?
}
```

### 3.4 Por qué dos fuentes y no un libro único

El saldo de una cuenta sale de **dos** sitios: sus `AccountMovement` y las `Transaction` que la
señalan. La alternativa —escribir un `AccountMovement` espejo por cada transacción— deja un libro
único más bonito de consultar, pero obliga a mantener los dos en sintonía en cada alta, edición y
borrado de un movimiento, y ahí es donde aparecen los descuadres. Con dos fuentes no hay nada que
sincronizar: borrar una transacción la saca del saldo sola, porque el saldo la estaba sumando en
vivo.

El precio es que el libro de la cuenta mezcla dos tablas al mostrarse. Se paga una vez, en una
función, y no puede desincronizarse.

## 4. Reglas de cálculo

En `src/lib/calculations/accounts.ts`, puras y probadas:

```ts
export type AccountLedgerInput = {
  /** Movimientos con signo: OPENING, TRANSFER, CASH_BOX, ADJUSTMENT. */
  movements: { amount: MoneyInput }[];
  /** Movimientos de Finanzas asignados a la cuenta. */
  transactions: { type: "INCOME" | "EXPENSE"; amount: MoneyInput }[];
};

/** Suma con signo: los ingresos suman, los gastos restan, los movimientos ya vienen firmados. */
export function accountBalance(input: AccountLedgerInput): Decimal;

/** Total de las cuentas activas. */
export function accountsTotal(balances: MoneyInput[]): Decimal;
```

### 4.1 Saldos negativos: se muestran, no se bloquean

Las cajas de capital **impiden** quedar en negativo, y está bien: su libro es completo por
construcción, así que un negativo solo puede venir de un error real.

Las cuentas no: mientras haya movimientos sin asignar, el saldo está incompleto por diseño. Un
bloqueo saltaría por datos faltantes, no por un sobregiro de verdad, y te impediría registrar un
gasto que sí ocurrió. Por eso **ninguna operación se bloquea por saldo**; una cuenta en negativo
se pinta en rojo y ya.

La única excepción es el destino de una transferencia: no puedes transferir a la misma cuenta de
la que sacas.

### 4.2 Saldos incompletos

```ts
/** Cuántos movimientos de Finanzas siguen sin cuenta. */
export type AccountsSummary = {
  total: number;
  unassignedCount: number;
  byKind: { kind: AccountKind; total: number; count: number }[];
};
```

Mientras `unassignedCount > 0`, toda pantalla que muestre el total lo dice: *«Faltan N
movimientos por asignar; los saldos están incompletos»*. No se muestra un total limpio que no es
verdad.

## 5. Escrituras

En `src/server/services/accounts.ts`, siguiendo el patrón de `cash-boxes.ts`:

```ts
export async function accountBalanceOf(db: Db, accountId: string): Promise<Decimal>;
export async function assertAccountUsable(db: Db, accountId: string, field?: string);

export async function createAccount(input: CreateAccountInput);   // + OPENING si el saldo ≠ 0
export async function updateAccount(id: string, input: AccountInput);
export async function setAccountActive(id: string, active: boolean);
export async function deleteAccount(id: string);
export async function transferBetweenAccounts(fromId: string, input: AccountTransferInput);
export async function adjustAccount(id: string, input: AccountAdjustmentInput);
export async function assignTransactionAccount(transactionId: string, accountId: string);
```

`deleteAccount` solo procede si la cuenta no tiene transacciones ni movimientos distintos de
`OPENING` — igual que `deleteCashBox` ignora su ajuste de apertura. Si los tiene, el mensaje
propone desactivarla.

`transferBetweenAccounts` escribe las dos patas dentro de una `$transaction` con el mismo
`transferGroupId`, rechaza origen igual a destino y exige que ambas estén activas.

## 6. La conexión con las cajas de capital

`depositToCashBox` y `withdrawFromCashBox` ganan `accountId` **obligatorio** en su entrada cuando
`counterparty` es `PERSONAL_FINANCES`, y opcional —ignorado— cuando es `EXTERNAL`, porque ese
dinero no sale de una cuenta tuya.

Dentro de la misma `$transaction` que ya existe:

| Operación | Caja | Cuenta |
|---|---|---|
| Depositar $1.000.000 desde Bancolombia | `DEPOSIT +1.000.000` | `CASH_BOX −1.000.000` |
| Retirar $500.000 hacia Efectivo | `WITHDRAWAL −500.000` | `CASH_BOX +500.000` |

El `AccountMovement` guarda `cashBoxMovementId`, así que desde el libro de la cuenta se puede
saltar a la caja y al revés. Si la caja se borra, `onDelete: SetNull` deja el movimiento de la
cuenta en pie: el dinero salió de tu bolsillo de verdad y borrar una caja no lo devuelve.

## 7. Los cuatro sitios donde nace una transacción

Esto es lo que hace que el trabajo sea más grande de lo que parece. Hoy se crean transacciones
desde cuatro sitios y **todos** necesitan una cuenta:

| Dónde | Archivo | Qué cambia |
|---|---|---|
| Formulario de movimiento | `src/components/finance/transaction-form-dialog.tsx` | Campo «Cuenta», obligatorio |
| Marcar pagado un recurrente | `src/server/services/recurring.ts:101` | `RecurringExpense` gana `accountId` opcional como cuenta habitual; el diálogo de marcar pagado la propone y deja cambiarla |
| Pagar una tarjeta | `src/server/services/credit-cards.ts:131` | El diálogo de pago gana «¿desde qué cuenta?» |
| Confirmar un correo de la bandeja | `src/server/services/inbox.ts:66` | El diálogo de confirmar gana el campo |

`transactionSchema` gana `accountId: idSchema` **obligatorio**. Los movimientos viejos siguen con
`null` en la base, pero editar uno exige elegir cuenta — que es justamente el flujo de asignación
manual que pidió el usuario.

## 8. Pantallas

### 8.1 `/finanzas/cuentas`

Pestaña nueva en `FinanceNav`, después de Resumen. Arriba, el total de las cuentas activas y, si
hay movimientos sin asignar, el aviso de §4.2 con enlace al filtro. Debajo, las cuentas agrupadas
por tipo, cada una como tarjeta con nombre, emisor, saldo y acciones: editar, transferir,
ajustar, activar/desactivar, eliminar.

En móvil una columna; desde `md` dos. Cuenta inactiva: atenuada y al final.

### 8.2 `/finanzas/cuentas/[id]`

Cabecera con el saldo y el libro combinado —`AccountMovement` y `Transaction`— con saldo
corriendo, igual que el detalle de una caja. Cada fila dice de dónde viene (un gasto, una
transferencia, una caja) y enlaza a su origen.

**El saldo corriendo se ordena por `createdAt`, no por la fecha del movimiento**, y la fecha del
movimiento se muestra igual. Es la misma decisión que se tomó en el detalle de una caja después
de que ordenar por fecha de negocio hiciera que una caja abriera en negativo: el saldo corriendo
solo tiene sentido en el orden en que se escribieron las filas.

### 8.3 Lista de Movimientos

Columna «Cuenta» y filtro por cuenta con una opción **«Sin cuenta»**. Desde una fila sin cuenta,
un selector asigna la cuenta en el sitio, sin abrir el formulario completo.

### 8.4 Resumen

El `StatCard` «Disponible estimado» pasa a calcularse como la suma de cuentas activas menos los
compromisos pendientes, en vez de la fórmula global. Es un número distinto al de hoy; ambos son
correctos según su definición, y el `hint` de la tarjeta lo explica.

## 9. Casos límite

| Situación | Qué pasa |
|---|---|
| No hay ninguna cuenta creada | Los formularios no pueden pedir una cuenta obligatoria: muestran un aviso con enlace a crear la primera |
| Cuenta inactiva | No aparece en los selectores, pero su historia y su saldo siguen visibles |
| Transferir a la misma cuenta | Se rechaza con mensaje en el campo destino |
| Borrar una cuenta con movimientos | Se rechaza y se propone desactivarla |
| Borrar una transacción asignada | El saldo de la cuenta baja solo: lo estaba sumando en vivo |
| Borrar una caja con movimientos espejo | El `AccountMovement` sobrevive con `cashBoxMovementId` en null |
| Saldo negativo | Se muestra en rojo, no se bloquea (§4.1) |
| Depósito a caja desde alguien externo | No pide cuenta: ese dinero no sale de una tuya |

## 10. Pruebas

**Vitest** (`src/lib/calculations/accounts.test.ts`): el saldo suma movimientos firmados e
ingresos y resta gastos; una cuenta sin nada vale cero; el total ignora las inactivas; el conteo
de no asignados.

**Playwright** (`e2e/accounts.spec.ts`): crear una cuenta con saldo inicial; registrar un gasto
desde ella y ver el saldo bajar; transferir a otra cuenta y ver las dos patas; depositar en una
caja de capital desde la cuenta y comprobar que baja la cuenta y sube la caja; asignar un
movimiento sin cuenta desde la lista y ver desaparecer el aviso de saldos incompletos.

## 11. Orden de trabajo

El módulo es del tamaño de las cajas de capital. El orden que mantiene la app funcionando en cada
paso:

1. Esquema, migración y cálculo puro con sus pruebas.
2. Servicios, consultas y acciones de cuentas.
3. Pantalla de cuentas y detalle.
4. El campo en el formulario de movimiento y el filtro «Sin cuenta» en la lista.
5. Los otros tres sitios que crean transacciones (§7).
6. La conexión con las cajas de capital.
7. El Resumen y el total, con su aviso de saldos incompletos.
8. E2E y verificación completa.
