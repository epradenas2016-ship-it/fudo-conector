// Conector MCP para Fudo <-> Claude
// -----------------------------------------------------------------
// Este servidor hace de "puentecito" entre Claude y la API de Fudo.
// Claude le pide datos a este server, y este server los busca en Fudo.
//
// NO hace falta tocar nada de este archivo. Solo hay que:
//   1. Subir esta carpeta a un hosting (instrucciones en README.md)
//   2. Configurar 1 variable de entorno: FUDO_API_SECRET
//      (el token que se genera en Fudo: Administración > Usuarios >
//      [usuario] > "Establecer API Secret")
//   3. Pegar la URL final en Claude (Configuración > Conectores)
// -----------------------------------------------------------------

import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const FUDO_API_BASE = "https://api.fu.do/v1alpha1";
// Fudo usa un único token ("API Secret"), generado a mano desde
// Administración > Usuarios > [usuario] > "Establecer API Secret".
// No existe un endpoint de login que intercambie key+secret por un token:
// este token YA es la credencial que se manda en cada pedido.
const FUDO_API_SECRET = process.env.FUDO_API_SECRET;

if (!FUDO_API_SECRET) {
  console.warn(
    "⚠️  Falta configurar FUDO_API_SECRET como variable de entorno."
  );
}

async function fudoRequest(path, { method = "GET", query = {} } = {}) {
  if (!FUDO_API_SECRET) {
    throw new Error(
      "Falta configurar la variable de entorno FUDO_API_SECRET con el token generado en Fudo."
    );
  }
  const url = new URL(`${FUDO_API_BASE}${path}`);
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });

  const resp = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${FUDO_API_SECRET}`,
      Accept: "application/json",
    },
  });

  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Fudo respondió con error ${resp.status}: ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ------------------------------------------------------------------
// Definición del servidor MCP y sus "herramientas" (tools)
// Estas son las acciones que Claude va a poder pedir.
// ------------------------------------------------------------------
function buildMcpServer() {
  const server = new McpServer({
    name: "fudo-connector",
    version: "1.0.0",
  });

  server.registerTool(
    "consultar_ventas",
    {
      title: "Consultar ventas de Fudo",
      description:
        "Trae las ventas registradas en Fudo, opcionalmente filtradas por rango de fechas (formato YYYY-MM-DD).",
      inputSchema: {
        fecha_desde: z
          .string()
          .optional()
          .describe("Fecha inicial, formato YYYY-MM-DD"),
        fecha_hasta: z
          .string()
          .optional()
          .describe("Fecha final, formato YYYY-MM-DD"),
      },
    },
    async ({ fecha_desde, fecha_hasta }) => {
      const data = await fudoRequest("/sales", {
        query: { from: fecha_desde, to: fecha_hasta },
      });
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.registerTool(
    "consultar_stock",
    {
      title: "Consultar stock de Fudo",
      description:
        "Trae el stock actual de productos en Fudo. Se puede filtrar por nombre de producto.",
      inputSchema: {
        producto: z
          .string()
          .optional()
          .describe("Nombre o parte del nombre del producto a buscar"),
      },
    },
    async ({ producto }) => {
      const data = await fudoRequest("/products", {
        query: { search: producto },
      });
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.registerTool(
    "consultar_pedidos",
    {
      title: "Consultar pedidos de Fudo",
      description: "Trae los pedidos/comandas registrados en Fudo.",
      inputSchema: {
        estado: z
          .string()
          .optional()
          .describe("Filtrar por estado del pedido, si aplica (ej: abierto, cerrado)"),
      },
    },
    async ({ estado }) => {
      const data = await fudoRequest("/sales", {
        query: { status: estado },
      });
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  // Herramienta genérica de respaldo: por si algún endpoint no coincide
  // exactamente con los de arriba, esto permite pedirle a Claude que
  // llame cualquier ruta de la API de Fudo directamente.
  server.registerTool(
    "fudo_request_generico",
    {
      title: "Pedido genérico a la API de Fudo",
      description:
        "Llama a cualquier endpoint de la API de Fudo directamente (para casos no cubiertos por las otras herramientas). Usar solo si las herramientas específicas no traen lo que se necesita.",
      inputSchema: {
        path: z
          .string()
          .describe("Ruta del endpoint, ej: /sales, /products, /categories"),
        query: z
          .record(z.string())
          .optional()
          .describe("Parámetros de consulta opcionales, como un objeto clave-valor"),
      },
    },
    async ({ path, query }) => {
      const data = await fudoRequest(path, { query: query || {} });
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  return server;
}

// ------------------------------------------------------------------
// Servidor HTTP (Streamable HTTP, el transporte que usa Claude)
// ------------------------------------------------------------------
const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  try {
    const server = buildMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("Error manejando pedido MCP:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Error interno del conector" });
    }
  }
});

// Endpoint simple para chequear que el servidor está vivo
app.get("/", (_req, res) => {
  res.send("Conector Fudo <-> Claude andando ✅");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Conector Fudo escuchando en el puerto ${PORT}`);
});
