package com.chxrd.performancepanel;

import java.io.IOException;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Supplier;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

final class BridgeServer implements AutoCloseable {
    private static final int MAX_QUERY_LENGTH = 4096;
    private final HttpServer server;
    private final Supplier<String> state;
    private final ConcurrentLinkedQueue<Command> commands;
    private final String origin;
    private final AtomicBoolean stateRequested = new AtomicBoolean(true);

    BridgeServer(
        final int port,
        final Supplier<String> state,
        final ConcurrentLinkedQueue<Command> commands) throws IOException {
        this.state = state;
        this.commands = commands;
        final HttpServer candidate = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
        origin = "http://127.0.0.1:" + candidate.getAddress().getPort();
        try {
            candidate.setExecutor(Executors.newSingleThreadExecutor(runnable -> {
                final Thread thread = new Thread(runnable, "performance-panel-http");
                thread.setDaemon(true);
                return thread;
            }));
            candidate.createContext("/v1/state", this::state);
            candidate.createContext("/v1/command", this::command);
            candidate.createContext("/health", exchange -> respond(exchange, 200, "text/plain; charset=utf-8", "ok\n"));
            candidate.createContext("/", this::asset);
        } catch (final RuntimeException | Error error) {
            candidate.stop(0);
            throw error;
        }
        server = candidate;
    }

    void start() { server.start(); }

    int port() { return server.getAddress().getPort(); }

    boolean consumeStateRequest() { return stateRequested.getAndSet(false); }

    private void state(final HttpExchange exchange) throws IOException {
        if (preflight(exchange)) return;
        if (!"GET".equals(exchange.getRequestMethod())) {
            respond(exchange, 405, "application/json", "{\"error\":\"method\"}");
            return;
        }
        stateRequested.set(true);
        respond(exchange, 200, "application/json; charset=utf-8", state.get());
    }

    private void command(final HttpExchange exchange) throws IOException {
        if (preflight(exchange)) return;
        if (!trustedOrigin(exchange)) {
            respond(exchange, 403, "application/json", "{\"error\":\"origin\"}");
            return;
        }
        if (!"POST".equals(exchange.getRequestMethod())) {
            respond(exchange, 405, "application/json", "{\"error\":\"method\"}");
            return;
        }
        final String rawQuery = exchange.getRequestURI().getRawQuery();
        if (rawQuery != null && rawQuery.length() > MAX_QUERY_LENGTH) {
            respond(exchange, 413, "application/json", "{\"error\":\"query-too-large\"}");
            return;
        }
        final Map<String, String> query = query(rawQuery);
        final String action = query.getOrDefault("action", "");
        if (action.isBlank()) {
            respond(exchange, 400, "application/json", "{\"error\":\"action\"}");
            return;
        }
        commands.add(Command.of(
            action,
            query.get("bank"),
            query.get("page"),
            query.get("index"),
            query.get("value"),
            query.get("text")));
        respond(exchange, 202, "application/json", "{\"queued\":true}");
    }

    private void asset(final HttpExchange exchange) throws IOException {
        if (!"GET".equals(exchange.getRequestMethod())) {
            respond(exchange, 405, "text/plain; charset=utf-8", "Method not allowed\n");
            return;
        }
        final String requested = exchange.getRequestURI().getPath();
        final String resource = "/".equals(requested) ? "/app/index.html" : requested;
        if (!resource.startsWith("/app/") || resource.contains("..")) {
            respond(exchange, 404, "text/plain; charset=utf-8", "Not found\n");
            return;
        }
        try (InputStream input = BridgeServer.class.getResourceAsStream(resource)) {
            if (input == null) {
                respond(exchange, 404, "text/plain; charset=utf-8", "Not found\n");
                return;
            }
            respond(exchange, 200, contentType(resource), input.readAllBytes());
        }
    }

    private static String contentType(final String path) {
        if (path.endsWith(".html")) return "text/html; charset=utf-8";
        if (path.endsWith(".css")) return "text/css; charset=utf-8";
        if (path.endsWith(".js") || path.endsWith(".mjs")) return "text/javascript; charset=utf-8";
        if (path.endsWith(".json")) return "application/json; charset=utf-8";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".ttf")) return "font/ttf";
        return "application/octet-stream";
    }

    private static boolean preflight(final HttpExchange exchange) throws IOException {
        if (!"OPTIONS".equals(exchange.getRequestMethod())) return false;
        cors(exchange);
        exchange.sendResponseHeaders(204, -1);
        exchange.close();
        return true;
    }

    private boolean trustedOrigin(final HttpExchange exchange) {
        final String requestOrigin = exchange.getRequestHeaders().getFirst("Origin");
        return requestOrigin == null
            || origin.equals(requestOrigin)
            || "http://127.0.0.1:32147".equals(requestOrigin);
    }

    private static Map<String, String> query(final String raw) {
        final Map<String, String> values = new HashMap<>();
        if (raw == null || raw.isBlank()) return values;
        for (final String pair : raw.split("&")) {
            final String[] parts = pair.split("=", 2);
            final String key = URLDecoder.decode(parts[0], StandardCharsets.UTF_8);
            final String value = parts.length == 2
                ? URLDecoder.decode(parts[1], StandardCharsets.UTF_8)
                : "";
            values.put(key, value);
        }
        return values;
    }

    private static void respond(
        final HttpExchange exchange,
        final int status,
        final String contentType,
        final String body) throws IOException {
        final byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        respond(exchange, status, contentType, bytes);
    }

    private static void respond(
        final HttpExchange exchange,
        final int status,
        final String contentType,
        final byte[] bytes) throws IOException {
        cors(exchange);
        exchange.getResponseHeaders().set("Content-Type", contentType);
        exchange.getResponseHeaders().set("Cache-Control", "no-store");
        exchange.getResponseHeaders().set("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self' http://127.0.0.1:32146");
        exchange.getResponseHeaders().set("Referrer-Policy", "no-referrer");
        exchange.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
        exchange.getResponseHeaders().set("X-Frame-Options", "DENY");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }

    private static void cors(final HttpExchange exchange) {
        final String origin = exchange.getRequestHeaders().getFirst("Origin");
        if ("http://127.0.0.1:32147".equals(origin)) {
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", origin);
        }
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");
    }

    @Override
    public void close() { server.stop(0); }
}
