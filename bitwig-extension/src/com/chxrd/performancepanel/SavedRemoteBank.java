package com.chxrd.performancepanel;

import com.bitwig.extension.controller.api.CursorDeviceFollowMode;
import com.bitwig.extension.controller.api.CursorRemoteControlsPage;
import com.bitwig.extension.controller.api.CursorTrack;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.Parameter;
import com.bitwig.extension.controller.api.PinnableCursorDevice;
import com.bitwig.extension.controller.api.RemoteControl;
import com.bitwig.extension.controller.api.Track;
import com.bitwig.extension.controller.api.Value;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

final class SavedRemoteBank {
    static final int CONTROL_COUNT = 8;
    static final int PAGE_STACK_COUNT = 1;

    private final int index;
    private final CursorTrack track;
    private final List<Track> parents = new ArrayList<>();
    private final PinnableCursorDevice device;
    private final CursorRemoteControlsPage remotes;
    private final List<CursorRemoteControlsPage> remotePages = new ArrayList<>();

    SavedRemoteBank(final ControllerHost host, final int index) {
        this.index = index;
        track = host.createCursorTrack(
            "performance-panel-saved-track-" + index,
            "Performance Panel Saved Track " + (index + 1),
            0,
            0,
            true);
        device = track.createCursorDevice(
            "performance-panel-saved-device-" + index,
            "Performance Panel Saved Device " + (index + 1),
            0,
            CursorDeviceFollowMode.FOLLOW_SELECTION);
        for (int page = 0; page < PAGE_STACK_COUNT; ++page) {
            final CursorRemoteControlsPage remotePage = device.createCursorRemoteControlsPage(
                "performance-panel-saved-remotes-" + index + "-" + page,
                CONTROL_COUNT,
                "");
            interest(remotePage.getName());
            interest(remotePage.selectedPageIndex());
            interest(remotePage.pageCount());
            for (int control = 0; control < CONTROL_COUNT; ++control) {
                prepare(remotePage.getParameter(control));
            }
            remotePages.add(remotePage);
        }
        remotes = remotePages.get(0);

        Track parent = track.createParentTrack(0, 0);
        for (int depth = 0; depth < 8; ++depth) {
            interest(parent.exists());
            interest(parent.name());
            interest(parent.channelId());
            parents.add(parent);
            parent = parent.createParentTrack(0, 0);
        }

        interest(track.isPinned());
        interest(track.exists());
        interest(track.name());
        interest(track.channelId());
        interest(track.color());
        interest(device.isPinned());
        interest(device.exists());
        interest(device.name());
    }

    int index() { return index; }
    boolean isPinned() { return track.isPinned().get() && device.isPinned().get(); }
    boolean exists() { return track.exists().get() && device.exists().get(); }
    String trackName() { return track.name().get(); }
    String trackColor() {
        final var color = track.color().get();
        return color == null ? "" : color.toHex();
    }
    String trackPath() {
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
        if (!trackName().isBlank()) parts.add(trackName());
        return String.join(" / ", parts);
    }
    String deviceName() { return device.name().get(); }
    String pageName() { return remotes.getName().get(); }
    int pageIndex() { return remotes.selectedPageIndex().get() + 1; }
    int pageCount() { return remotes.pageCount().get(); }
    boolean pageAvailable(final int offset) { return pageIndex() + offset <= pageCount(); }
    CursorRemoteControlsPage page(final int offset) { return remotePages.get(offset); }
    RemoteControl remote(final int page, final int control) { return remotePages.get(page).getParameter(control); }

    void pinDeviceFrom(final CursorRemoteControlsPage source) {
        final int basePage = source.selectedPageIndex().get();
        device.isPinned().set(false);
        track.isPinned().set(false);
        for (int page = 0; page < remotePages.size(); ++page) {
            remotePages.get(page).selectedPageIndex().set(basePage + page);
        }
        device.isPinned().set(true);
        track.isPinned().set(true);
    }

    void release() {
        device.isPinned().set(false);
        track.isPinned().set(false);
    }

    private static void prepare(final Parameter parameter) {
        interest(parameter.name());
        interest(parameter.value());
        interest(parameter.modulatedValue());
        interest(parameter.displayedValue());
        interest(parameter.discreteValueCount());
        interest(parameter.exists());
    }

    private static String identity(final Track track) {
        final String channelId = track.channelId().get();
        return channelId.isBlank() ? "name:" + track.name().get() : "id:" + channelId;
    }

    private static void interest(final Value<?> value) { value.markInterested(); }
}
