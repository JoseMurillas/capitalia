/**
 * Capitalia · reenvío de correos del banco (Google Apps Script)
 *
 * Qué hace: cada pocos minutos busca en Gmail los correos con la etiqueta
 * "capitalia" que aún no se han enviado, los manda a tu Capitalia y los marca
 * con la etiqueta "capitalia-enviado". Capitalia los deja en Finanzas →
 * Bandeja del banco para que confirmes cada movimiento.
 *
 * Configuración (una sola vez):
 *  1. En Gmail crea un filtro: De: <correo de alertas de tu banco> → Aplicar
 *     la etiqueta "capitalia" (créala si no existe). Puedes agregar varios bancos.
 *  2. Entra a https://script.google.com → Nuevo proyecto → pega este archivo.
 *  3. Cambia CAPITALIA_URL y CAPITALIA_TOKEN (el mismo valor de INBOX_TOKEN en Vercel).
 *  4. Ejecuta una vez la función `syncCapitalia` (te pedirá permisos de Gmail).
 *  5. Activadores (icono del reloj) → Añadir activador → syncCapitalia ·
 *     Basado en tiempo · Cada 5 minutos → Guardar.
 */

const CAPITALIA_URL = "https://capitalia-5t62.vercel.app/api/inbox";
const CAPITALIA_TOKEN = "PEGA_AQUI_TU_INBOX_TOKEN";

const LABEL_PENDING = "capitalia";
const LABEL_SENT = "capitalia-enviado";
const MAX_MESSAGES = 50;

function syncCapitalia() {
  const sentLabel = GmailApp.getUserLabelByName(LABEL_SENT) || GmailApp.createLabel(LABEL_SENT);
  const threads = GmailApp.search(`label:${LABEL_PENDING} -label:${LABEL_SENT} newer_than:30d`, 0, MAX_MESSAGES);
  if (threads.length === 0) return;

  const messages = [];
  threads.forEach((thread) => {
    thread.getMessages().forEach((message) => {
      messages.push({
        externalId: message.getId(),
        receivedAt: message.getDate().toISOString(),
        sender: message.getFrom(),
        subject: message.getSubject(),
        text: (message.getPlainBody() || "").trim().slice(0, 5000),
      });
    });
  });
  if (messages.length === 0) return;

  const response = UrlFetchApp.fetch(CAPITALIA_URL, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: `Bearer ${CAPITALIA_TOKEN}` },
    payload: JSON.stringify({ source: "email", messages: messages.slice(0, 100) }),
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() !== 200) {
    console.error(`Capitalia respondió ${response.getResponseCode()}: ${response.getContentText()}`);
    return;
  }

  threads.forEach((thread) => thread.addLabel(sentLabel));
  console.log(`Enviados ${messages.length} correos: ${response.getContentText()}`);
}
