package com.chxrd.performancepanel;

record Command(String action, int bank, int page, int index, double value, String text) {
    static Command of(
        final String action,
        final String bank,
        final String page,
        final String index,
        final String value,
        final String text) {
        return new Command(
            action,
            integer(bank, -1),
            integer(page, 0),
            integer(index, -1),
            decimal(value, 0.0),
            text == null ? "" : text);
    }

    private static int integer(final String value, final int fallback) {
        try { return value == null ? fallback : Integer.parseInt(value); }
        catch (final NumberFormatException ignored) { return fallback; }
    }

    private static double decimal(final String value, final double fallback) {
        try { return value == null ? fallback : Double.parseDouble(value); }
        catch (final NumberFormatException ignored) { return fallback; }
    }
}
