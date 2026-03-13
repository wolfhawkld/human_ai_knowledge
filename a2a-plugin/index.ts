/**
 * A2A Plugin - Agent-to-Agent Communication for OpenClaw
 * 
 * Enables peer-to-peer chat and file sharing between OpenClaw instances over LAN.
 * 
 * Features:
 * - Send messages to peer agents via /v1/chat/completions API
 * - Share files through a dedicated HTTP endpoint
 * - Discover peer capabilities
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { promises as fs } from "node:fs";
import { resolve, join, relative, isAbsolute } from "node:path";
import { homedir } from "node:os";

// ============ Types ============

interface PeerConfig {
  id: string;
  name?: string;
  host: string;
  port: number;
  token?: string;
}

interface FileShareConfig {
  enabled: boolean;
  basePath: string;
  readOnly: boolean;
}

interface A2AConfig {
  enabled: boolean;
  peers: PeerConfig[];
  fileShare: FileShareConfig;
}

type PluginConfig = Record<string, unknown> & {
  a2a?: A2AConfig;
};

// ============ Utilities ============

function expandPath(path: string): string {
  if (path.startsWith("~")) {
    return join(homedir(), path.slice(1));
  }
  return path;
}

async function safeReadFile(filePath: string): Promise<{ ok: true; content: Buffer } | { ok: false; error: string }> {
  try {
    const content = await fs.readFile(filePath);
    return { ok: true, content };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

async function safeWriteFile(filePath: string, content: Buffer): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    // Ensure parent directory exists
    const dir = resolve(filePath, "..");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

async function safeListDir(dirPath: string): Promise<{ ok: true; files: string[] } | { ok: false; error: string }> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files = entries.map(e => ({
      name: e.name,
      type: e.isDirectory() ? "directory" : "file",
    }));
    return { ok: true, files: files as unknown as string[] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

async function safeDelete(filePath: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await fs.unlink(filePath);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

// ============ Peer Communication ============

interface PeerMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatCompletionRequest {
  model?: string;
  messages: PeerMessage[];
  stream?: boolean;
}

async function sendToPeer(
  peer: PeerConfig,
  message: string,
  logger: { debug?: (msg: string) => void; error: (msg: string) => void }
): Promise<{ ok: true; response: string } | { ok: false; error: string }> {
  const url = `http://${peer.host}:${peer.port}/v1/chat/completions`;
  
  const body: ChatCompletionRequest = {
    model: "openclaw:main",
    messages: [{ role: "user", content: message }],
    stream: false,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (peer.token) {
    headers["Authorization"] = `Bearer ${peer.token}`;
  }

  try {
    logger.debug?.(`A2A: Sending to peer ${peer.id} at ${url}`);
    
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${text}` };
    }

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const response = data.choices?.[0]?.message?.content ?? "";
    
    return { ok: true, response };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`A2A: Failed to send to peer ${peer.id}: ${message}`);
    return { ok: false, error: message };
  }
}

// ============ HTTP Handlers ============

function parseJsonBody<T>(req: IncomingMessage): Promise<T | null> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        if (!body) {
          resolve(null);
          return;
        }
        resolve(JSON.parse(body) as T);
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function createFileHttpHandler(
  fileShare: FileShareConfig,
  logger: { debug?: (msg: string) => void; error: (msg: string) => void; info: (msg: string) => void }
) {
  const basePath = expandPath(fileShare.basePath);

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? "/", `http://localhost`);
    const pathParts = url.pathname.replace(/^\/a2a\/files\/?/, "").split("/").filter(Boolean);
    const requestedPath = pathParts.join("/");
    const fullPath = requestedPath ? join(basePath, requestedPath) : basePath;

    // Security: ensure path is within basePath
    const resolvedPath = resolve(fullPath);
    if (!resolvedPath.startsWith(resolve(basePath))) {
      sendJson(res, 403, { ok: false, error: "Access denied: path outside shared directory" });
      return;
    }

    try {
      switch (req.method) {
        case "GET": {
          // Check if it's a directory or file
          const stats = await fs.stat(resolvedPath).catch(() => null);
          
          if (!stats) {
            sendJson(res, 404, { ok: false, error: "Not found" });
            return;
          }

          if (stats.isDirectory()) {
            const result = await safeListDir(resolvedPath);
            if (result.ok) {
              sendJson(res, 200, { ok: true, path: requestedPath || "/", files: result.files });
            } else {
              sendJson(res, 500, { ok: false, error: result.error });
            }
          } else {
            const result = await safeReadFile(resolvedPath);
            if (result.ok) {
              // Return as base64 for binary safety
              res.writeHead(200, { 
                "Content-Type": "application/octet-stream",
                "X-File-Path": requestedPath,
              });
              res.end(result.content);
            } else {
              sendJson(res, 500, { ok: false, error: result.error });
            }
          }
          break;
        }

        case "POST": {
          if (fileShare.readOnly) {
            sendJson(res, 403, { ok: false, error: "Read-only mode" });
            return;
          }

          const body = await parseJsonBody<{ content?: string; encoding?: "utf8" | "base64" }>(req);
          if (!body || typeof body.content !== "string") {
            sendJson(res, 400, { ok: false, error: "Missing 'content' in request body" });
            return;
          }

          const content = body.encoding === "base64" 
            ? Buffer.from(body.content, "base64") 
            : Buffer.from(body.content, "utf8");

          const result = await safeWriteFile(resolvedPath, content);
          if (result.ok) {
            logger.info(`A2A: File written: ${requestedPath}`);
            sendJson(res, 200, { ok: true, path: requestedPath, size: content.length });
          } else {
            sendJson(res, 500, { ok: false, error: result.error });
          }
          break;
        }

        case "DELETE": {
          if (fileShare.readOnly) {
            sendJson(res, 403, { ok: false, error: "Read-only mode" });
            return;
          }

          const result = await safeDelete(resolvedPath);
          if (result.ok) {
            logger.info(`A2A: File deleted: ${requestedPath}`);
            sendJson(res, 200, { ok: true, path: requestedPath });
          } else {
            sendJson(res, 500, { ok: false, error: result.error });
          }
          break;
        }

        default:
          sendJson(res, 405, { ok: false, error: "Method not allowed" });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`A2A: File handler error: ${message}`);
      sendJson(res, 500, { ok: false, error: message });
    }
  };
}

// ============ Tool Definitions ============

const A2A_TOOLS = {
  listPeers: {
    name: "a2a_list_peers",
    description: "List all configured peer OpenClaw agents available for A2A communication",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  
  sendMessage: {
    name: "a2a_send_message",
    description: "Send a message to a peer OpenClaw agent and get a response. Use this to communicate with other AI agents in your network.",
    parameters: {
      type: "object",
      properties: {
        peerId: {
          type: "string",
          description: "The ID of the peer agent (e.g., 'nemo')",
        },
        message: {
          type: "string",
          description: "The message to send to the peer agent",
        },
      },
      required: ["peerId", "message"],
      additionalProperties: false,
    },
  },
  
  listFiles: {
    name: "a2a_list_files",
    description: "List files in a peer's shared directory",
    parameters: {
      type: "object",
      properties: {
        peerId: {
          type: "string",
          description: "The ID of the peer agent",
        },
        path: {
          type: "string",
          description: "Path relative to the shared directory (optional, defaults to root)",
        },
      },
      required: ["peerId"],
      additionalProperties: false,
    },
  },
  
  readFile: {
    name: "a2a_read_file",
    description: "Read a file from a peer's shared directory",
    parameters: {
      type: "object",
      properties: {
        peerId: {
          type: "string",
          description: "The ID of the peer agent",
        },
        path: {
          type: "string",
          description: "Path to the file relative to the shared directory",
        },
      },
      required: ["peerId", "path"],
      additionalProperties: false,
    },
  },
  
  writeFile: {
    name: "a2a_write_file",
    description: "Write a file to a peer's shared directory",
    parameters: {
      type: "object",
      properties: {
        peerId: {
          type: "string",
          description: "The ID of the peer agent",
        },
        path: {
          type: "string",
          description: "Path to the file relative to the shared directory",
        },
        content: {
          type: "string",
          description: "Content to write (text or base64 encoded)",
        },
        encoding: {
          type: "string",
          enum: ["utf8", "base64"],
          description: "Encoding of the content (default: utf8)",
        },
      },
      required: ["peerId", "path", "content"],
      additionalProperties: false,
    },
  },
  
  info: {
    name: "a2a_info",
    description: "Get information about this agent's A2A configuration and capabilities",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
};

// ============ Plugin Registration ============

export default {
  id: "a2a",
  name: "A2A",
  description: "Agent-to-Agent communication plugin for OpenClaw",
  
  register(api: OpenClawPluginApi) {
    const config = api.config as PluginConfig;
    const a2aConfig: A2AConfig = config.a2a ?? {
      enabled: false,
      peers: [],
      fileShare: { enabled: false, basePath: "~/.openclaw/a2a-share", readOnly: true },
    };

    if (!a2aConfig.enabled) {
      api.logger.info("A2A: Plugin disabled in config");
      return;
    }

    api.logger.info(`A2A: Initializing with ${a2aConfig.peers.length} peers`);

    // --- HTTP Routes ---
    
    // File sharing endpoint
    if (a2aConfig.fileShare.enabled) {
      const fileHandler = createFileHttpHandler(a2aConfig.fileShare, api.logger);
      
      api.registerHttpRoute({
        path: "/a2a/files",
        match: "prefix",
        auth: "gateway",
        handler: fileHandler,
      });
      
      api.logger.info(`A2A: File sharing enabled at /a2a/files/* (basePath: ${a2aConfig.fileShare.basePath})`);
    }

    // --- Agent Tools ---
    
    // a2a_list_peers
    api.registerTool({
      name: A2A_TOOLS.listPeers.name,
      description: A2A_TOOLS.listPeers.description,
      parameters: A2A_TOOLS.listPeers.parameters,
      async execute() {
        const peers = a2aConfig.peers.map(p => ({
          id: p.id,
          name: p.name ?? p.id,
          host: p.host,
          port: p.port,
          hasToken: !!p.token,
        }));
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ ok: true, peers }, null, 2),
          }],
        };
      },
    });

    // a2a_send_message
    api.registerTool({
      name: A2A_TOOLS.sendMessage.name,
      description: A2A_TOOLS.sendMessage.description,
      parameters: A2A_TOOLS.sendMessage.parameters,
      async execute(_toolCallId, params) {
        const { peerId, message } = params as { peerId: string; message: string };
        const peer = a2aConfig.peers.find(p => p.id === peerId);
        
        if (!peer) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ ok: false, error: `Peer not found: ${peerId}` }),
            }],
          };
        }

        const result = await sendToPeer(peer, message, api.logger);
        
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      },
    });

    // a2a_list_files
    api.registerTool({
      name: A2A_TOOLS.listFiles.name,
      description: A2A_TOOLS.listFiles.description,
      parameters: A2A_TOOLS.listFiles.parameters,
      async execute(_toolCallId, params) {
        const { peerId, path = "" } = params as { peerId: string; path?: string };
        const peer = a2aConfig.peers.find(p => p.id === peerId);
        
        if (!peer) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ ok: false, error: `Peer not found: ${peerId}` }),
            }],
          };
        }

        const url = `http://${peer.host}:${peer.port}/a2a/files/${path}`;
        const headers: Record<string, string> = {};
        if (peer.token) headers["Authorization"] = `Bearer ${peer.token}`;

        try {
          const res = await fetch(url, { headers });
          const data = await res.json();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(data, null, 2),
            }],
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ ok: false, error: message }),
            }],
          };
        }
      },
    });

    // a2a_read_file
    api.registerTool({
      name: A2A_TOOLS.readFile.name,
      description: A2A_TOOLS.readFile.description,
      parameters: A2A_TOOLS.readFile.parameters,
      async execute(_toolCallId, params) {
        const { peerId, path } = params as { peerId: string; path: string };
        const peer = a2aConfig.peers.find(p => p.id === peerId);
        
        if (!peer) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ ok: false, error: `Peer not found: ${peerId}` }),
            }],
          };
        }

        const url = `http://${peer.host}:${peer.port}/a2a/files/${path}`;
        const headers: Record<string, string> = {};
        if (peer.token) headers["Authorization"] = `Bearer ${peer.token}`;

        try {
          const res = await fetch(url, { headers });
          
          if (!res.ok) {
            const text = await res.text();
            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({ ok: false, error: `HTTP ${res.status}: ${text}` }),
              }],
            };
          }

          const buffer = await res.arrayBuffer();
          const content = Buffer.from(buffer).toString("base64");
          
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ 
                ok: true, 
                path, 
                encoding: "base64",
                content,
                size: buffer.byteLength,
              }, null, 2),
            }],
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ ok: false, error: message }),
            }],
          };
        }
      },
    });

    // a2a_write_file
    api.registerTool({
      name: A2A_TOOLS.writeFile.name,
      description: A2A_TOOLS.writeFile.description,
      parameters: A2A_TOOLS.writeFile.parameters,
      async execute(_toolCallId, params) {
        const { peerId, path, content, encoding = "utf8" } = params as {
          peerId: string;
          path: string;
          content: string;
          encoding?: "utf8" | "base64";
        };
        const peer = a2aConfig.peers.find(p => p.id === peerId);
        
        if (!peer) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ ok: false, error: `Peer not found: ${peerId}` }),
            }],
          };
        }

        const url = `http://${peer.host}:${peer.port}/a2a/files/${path}`;
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (peer.token) headers["Authorization"] = `Bearer ${peer.token}`;

        try {
          const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({ content, encoding }),
          });
          const data = await res.json();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(data, null, 2),
            }],
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ ok: false, error: message }),
            }],
          };
        }
      },
    });

    // a2a_info
    api.registerTool({
      name: A2A_TOOLS.info.name,
      description: A2A_TOOLS.info.description,
      parameters: A2A_TOOLS.info.parameters,
      async execute() {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              ok: true,
              agent: {
                id: "outis",
                host: "192.168.0.110",
                port: 18789,
              },
              peers: a2aConfig.peers.map(p => ({ id: p.id, name: p.name })),
              fileShare: {
                enabled: a2aConfig.fileShare.enabled,
                basePath: a2aConfig.fileShare.basePath,
                readOnly: a2aConfig.fileShare.readOnly,
              },
            }, null, 2),
          }],
        };
      },
    });

    api.logger.info("A2A: Plugin registered successfully");
  },
};