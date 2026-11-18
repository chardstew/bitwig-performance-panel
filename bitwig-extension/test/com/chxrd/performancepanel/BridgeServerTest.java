package com.chxrd.performancepanel;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.ConcurrentLinkedQueue;

public final class BridgeServerTest {
    private BridgeServerTest() {}

    public static void main(final String[] args) throws Exception {
        final var commands = new ConcurrentLinkedQueue<Command>();
        try (var server = new BridgeServer(0, () -> "{\"connected\":true}", commands)) {
            server.start();
            final String origin = "http://127.0.0.1:" + server.port();
            final HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(2))
                .build();

            final var state = send(client, HttpRequest.newBuilder(URI.create(origin + "/v1/state")).GET().build());
            require(state.statusCode() == 200, "state status");
            require(state.body().contains("\"connected\":true"), "state body");
            require(server.consumeStateRequest(), "state request signal");

            final var command = send(client, HttpRequest.newBuilder(
                URI.create(origin + "/v1/command?action=set-remote&index=2&value=0.75"))
                .header("Origin", origin)
                .POST(HttpRequest.BodyPublishers.noBody())
                .build());
            require(command.statusCode() == 202, "command status");
            final Command queued = commands.poll();
            require(queued != null && "set-remote".equals(queued.action()), "queued action");
            require(queued.index() == 2 && queued.value() == 0.75, "queued values");

            final var foreign = send(client, HttpRequest.newBuilder(
                URI.create(origin + "/v1/command?action=undo"))
                .header("Origin", "https://example.com")
                .POST(HttpRequest.BodyPublishers.noBody())
                .build());
            require(foreign.statusCode() == 403, "foreign origin rejection");

            final String oversized = "x".repeat(4100);
            final var large = send(client, HttpRequest.newBuilder(
                URI.create(origin + "/v1/command?action=undo&text=" + oversized))
                .header("Origin", origin)
                .POST(HttpRequest.BodyPublishers.noBody())
                .build());
            require(large.statusCode() == 413, "oversized query rejection");

            final var asset = send(client, HttpRequest.newBuilder(URI.create(origin + "/")).GET().build());
            require(asset.statusCode() == 200 && asset.body().contains("Performance Panel"), "bundled asset");
            require("nosniff".equals(asset.headers().firstValue("x-content-type-options").orElse("")), "security headers");
        }
    }

    private static HttpResponse<String> send(final HttpClient client, final HttpRequest request) throws Exception {
        return client.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private static void require(final boolean condition, final String label) {
        if (!condition) throw new AssertionError(label);
    }
}
