package com.chxrd.performancepanel;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.BooleanValue;
import com.bitwig.extension.controller.api.CursorTrack;
import com.bitwig.extension.controller.api.Parameter;
import com.bitwig.extension.controller.api.Track;
import com.bitwig.extension.controller.api.Value;

final class MixerChannel {
    private final int index;
    private final CursorTrack track;
    private final BooleanValue masterMatch;
    private final List<Track> parents = new ArrayList<>();
    private int meter;

    MixerChannel(final ControllerHost host, final int index, final Track masterTrack) {
        this.index = index;
        track = host.createCursorTrack(
            "performance-panel-mixer-track-" + index,
            "Performance Panel Mixer Track " + (index + 1),
            0,
            0,
            true);
        interest(track.isPinned());
        interest(track.exists());
        interest(track.name());
        interest(track.channelId());
        interest(track.position());
        interest(track.color());
        interest(track.mute());
        interest(track.solo());
        interest(track.arm());
        masterMatch = track.createEqualsValue(masterTrack);
        interest(masterMatch);
        prepare(track.volume());
        prepare(track.pan());
        track.addVuMeterObserver(128, 0, true, value -> meter = value);

        Track parent = track.createParentTrack(0, 0);
        for (int depth = 0; depth < 8; ++depth) {
            interest(parent.exists());
            interest(parent.name());
            interest(parent.channelId());
            parents.add(parent);
            parent = parent.createParentTrack(0, 0);
        }
    }

    int index() { return index; }
    boolean isPinned() { return track.isPinned().get(); }
    boolean exists() { return track.exists().get(); }
    String name() { return track.name().get(); }
    String channelId() { return track.channelId().get(); }
    int position() { return track.position().get(); }
    String color() {
        final var color = track.color().get();
        return color == null ? "" : color.toHex();
    }
    String path() {
        final List<String> parts = new ArrayList<>();
        final Set<String> seen = new HashSet<>();
        seen.add(identity(track));
        for (final Track parent : parents) {
            if (!parent.exists().get()) break;
            final String identity = identity(parent);
            if (!seen.add(identity)) break;
            if (!parent.name().get().isBlank()) parts.add(parent.name().get());
        }
        Collections.reverse(parts);
        if (!name().isBlank()) parts.add(name());
        return String.join(" / ", parts);
    }
    double volume() { return track.volume().value().get(); }
    String volumeDisplay() { return track.volume().displayedValue().get(); }
    double pan() { return track.pan().value().get(); }
    String panDisplay() { return track.pan().displayedValue().get(); }
    boolean mute() { return track.mute().get(); }
    boolean solo() { return track.solo().get(); }
    boolean arm() { return track.arm().get(); }
    boolean isMaster() { return masterMatch.get(); }
    double meter() { return meter / 127.0; }

    void pinFrom(final Track source) {
        track.selectChannel(source);
        track.isPinned().set(true);
    }
    void release() { track.isPinned().set(false); }
    void setVolume(final double value) { setNormalized(track.volume(), value); }
    void setPan(final double value) { setNormalized(track.pan(), value); }
    void setMute(final boolean value) { track.mute().set(value); }
    void setSolo(final boolean value, final boolean exclusive) {
        if (track.solo().get() != value) track.solo().toggle(exclusive);
    }
    void setArm(final boolean value) { track.arm().set(value); }

    private static void setNormalized(final Parameter parameter, final double value) {
        parameter.value().setImmediately(Math.max(0.0, Math.min(1.0, value)));
    }
    private static void prepare(final Parameter parameter) {
        interest(parameter.value());
        interest(parameter.displayedValue());
        interest(parameter.exists());
    }
    private static String identity(final Track track) {
        final String channelId = track.channelId().get();
        return channelId.isBlank() ? "name:" + track.name().get() : "id:" + channelId;
    }
    private static void interest(final Value<?> value) { value.markInterested(); }
}
