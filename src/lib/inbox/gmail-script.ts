/**
 * Google Apps Script the user pastes into script.google.com. Generated with the
 * app's own URL and token so nothing has to be edited by hand.
 */
export function buildGmailScript(endpointUrl: string, token: string): string {
  return `// Capitalia · reenvío de correos del banco
// 1) En Gmail crea un filtro que aplique la etiqueta "capitalia" a los correos de tu banco.
// 2) Pega este código en script.google.com, ejecuta syncCapitalia una vez (acepta permisos)
//    y crea un activador "basado en tiempo" cada 5 minutos.

const CAPITALIA_URL = ${JSON.stringify(endpointUrl)};
const CAPITALIA_TOKEN = ${JSON.stringify(token)};
const LABEL_PENDING = "capitalia";
const LABEL_SENT = "capitalia-enviado";

function syncCapitalia() {
  const sentLabel = GmailApp.getUserLabelByName(LABEL_SENT) || GmailApp.createLabel(LABEL_SENT);
  const threads = GmailApp.search("label:" + LABEL_PENDING + " -label:" + LABEL_SENT + " newer_than:30d", 0, 50);
  if (threads.length === 0) return;

  const messages = [];
  threads.forEach(function (thread) {
    thread.getMessages().forEach(function (message) {
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
    headers: { Authorization: "Bearer " + CAPITALIA_TOKEN },
    payload: JSON.stringify({ source: "email", messages: messages.slice(0, 100) }),
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() !== 200) {
    console.error("Capitalia respondió " + response.getResponseCode() + ": " + response.getContentText());
    return;
  }
  threads.forEach(function (thread) { thread.addLabel(sentLabel); });
  console.log("Enviados " + messages.length + " correos: " + response.getContentText());
}
`;
}
