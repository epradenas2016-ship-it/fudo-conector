# Conector Fudo <-> Claude

Este es el "puentecito" que le permite a Claude leer ventas, stock y pedidos
directamente desde tu cuenta de Fudo.

No hace falta entender el código de adentro. Solo seguir estos pasos.

---

## Paso 1: Subir esto a un hosting gratuito (Render.com)

1. Andá a https://render.com y creá una cuenta gratis (podés entrar con Google).
2. Subí esta carpeta a un repositorio de GitHub (si no tenés, se puede crear
   uno gratis en https://github.com y arrastrar los archivos ahí, sin usar la consola).
3. En Render: **New +** → **Web Service** → conectá tu repositorio de GitHub.
4. Configuración del servicio:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. En la sección **Environment Variables**, agregá estas dos:
   - `FUDO_API_KEY` → pegar la API Key que te dio Fudo (la que se ve en la
     pantalla de tu usuario, ej: `MkAyODkyMDg=`)
   - `FUDO_API_SECRET` → pegar el API Secret que Fudo te mostró al crear el
     token (esa clave larga que hay que guardar apenas se genera)
6. Hacé clic en **Create Web Service** y esperá a que termine de desplegar
   (unos 2-3 minutos). Cuando termine, Render te va a dar una URL parecida a:

   ```
   https://fudo-mcp-connector.onrender.com
   ```

---

## Paso 2: Conectar esa URL con Claude

1. En Claude, andá a **Configuración > Conectores**.
2. Hacé clic en **Agregar conector personalizado**.
3. Pegá esta URL, agregando `/mcp` al final:

   ```
   https://fudo-mcp-connector.onrender.com/mcp
   ```

4. Guardá y activá el conector para tu conversación.

---

## Paso 3: ¡Probarlo!

Ahora simplemente le podés preguntar a Claude cosas como:

- "¿Cómo vienen las ventas de esta semana en Fudo?"
- "¿Cuánto stock queda del producto X?"
- "Mostrame los pedidos de hoy"

Claude va a usar el conector automáticamente para buscar esa información.

---

## ⚠️ Nota importante para quien lo configure

Los nombres exactos de los "endpoints" (las rutas dentro de la API de Fudo,
como `/sales` o `/products`) se basaron en la documentación pública general
de Fudo. Antes de darlo por terminado, conviene entrar a la documentación
técnica oficial (el link que Fudo mandó por mail, `dev.fu.do/api`) y
confirmar que esos nombres coinciden. Si algo cambió, solo hay que ajustar
las rutas dentro de `server.js` (están comentadas y son fáciles de ubicar).

Si algún endpoint específico no funciona, la herramienta
"fudo_request_generico" permite que Claude pruebe rutas alternativas sin
tener que tocar el código.
