# ClouKo - Bot mínimo de WhatsApp (Twilio Sandbox + Google Sheets)
Asistente de WhatsApp para responder precios/duraciones y llevar a reserva en Wix.

## 1) Catálogo en Google Sheets
1. Crea una Google Sheet con columnas EXACTAS:
   - `Servicio`
   - `Categoría`
   - `Duración_min`
   - `Precio_CLP`
   - `Notas`
2. Rellena tus servicios.
3. Comparte como "Cualquiera con el enlace (Lector)" y construye el link CSV:
   `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/export?format=csv&gid=GID`

## 2) Twilio WhatsApp Sandbox
1. Crea cuenta en Twilio y activa **WhatsApp Sandbox**.
2. Desde tu WhatsApp personal, envía el código de unión al número del Sandbox.
3. Anota:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - Número del Sandbox (ej: +14155238886)

## 3) Despliegue rápido (Render)
1. Sube estos archivos a un repo o zipéalo y súbelo como nuevo servicio **Web Service**.
2. En **Environment** agrega las variables del archivo `.env.example`.
3. Comando de inicio: `node server.js` (ya en package.json).

## 4) Webhook en Twilio
En Twilio Console -> Messaging -> WhatsApp Sandbox -> **When a message comes in**:
- Pega la URL pública de tu servicio + `/whatsapp` (ej: `https://miapp.onrender.com/whatsapp`).

## 5) Probar
- Desde tu WhatsApp (ya unido al Sandbox), envía: `manicure` o `balayage`.
- Debería responder con nombre, precio, duración y link de reserva.
