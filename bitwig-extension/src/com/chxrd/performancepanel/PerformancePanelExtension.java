package com.chxrd.performancepanel;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ConcurrentLinkedQueue;

import com.bitwig.extension.controller.ControllerExtension;
import com.bitwig.extension.controller.api.Application;
import com.bitwig.extension.controller.api.BeatTimeFormatter;
import com.bitwig.extension.controller.api.BooleanValue;
import com.bitwig.extension.controller.api.ControllerHost;
import com.bitwig.extension.controller.api.CursorRemoteControlsPage;
import com.bitwig.extension.controller.api.CursorTrack;
import com.bitwig.extension.controller.api.DeviceBank;
import com.bitwig.extension.controller.api.MasterTrack;
import com.bitwig.extension.controller.api.Parameter;
import com.bitwig.extension.controller.api.PinnableCursorDevice;
import com.bitwig.extension.controller.api.RemoteControl;
import com.bitwig.extension.controller.api.SettableBooleanValue;
import com.bitwig.extension.controller.api.SettableEnumValue;
import com.bitwig.extension.controller.api.SettableStringValue;
import com.bitwig.extension.controller.api.Track;
import com.bitwig.extension.controller.api.TrackBank;
import com.bitwig.extension.controller.api.Transport;

public final class PerformancePanelExtension extends ControllerExtension {
    static final int REMOTE_COUNT = 8;
    static final int PAGE_STACK_COUNT = 4;
    static final int SAVED_BANK_COUNT = 32;
    static final int MIXER_TRACK_COUNT = 32;
    static final int TRACK_SCAN_LIMIT = 128;
    static final int DEVICE_SCAN_LIMIT = 64;
    static final int PORT = 32146;

    private final ControllerHost host;
    private final ConcurrentLinkedQueue<Command> commands = new ConcurrentLinkedQueue<>();
    private CursorTrack track;
    private TrackBank trackBank;
    private TrackBank effectTrackBank;
    private MasterTrack masterTrack;
    private PinnableCursorDevice device;
    private DeviceBank deviceBank;
    private CursorRemoteControlsPage remotes;
    private final List<CursorRemoteControlsPage> remotePages = new ArrayList<>();
    private final List<SavedRemoteBank> savedBanks = new ArrayList<>();
    private final List<MixerChannel> mixerChannels = new ArrayList<>();
    private final List<BooleanValue> deviceMatches = new ArrayList<>();
    private final List<TrackEntry> trackEntries = new ArrayList<>();
    private SettableBooleanValue includeGroups;
    private SettableBooleanValue includeEffectTracks;
    private SettableBooleanValue includeMasterTrack;
    private SettableEnumValue bankLayout;
    private SettableEnumValue bankSize;
    private SettableBooleanValue useTrackColor;
    private SettableBooleanValue showTransportBar;
    private SettableBooleanValue showRemoteControls;
    private SettableEnumValue remoteControlsPosition;
    private SettableBooleanValue showMixer;
    private SettableBooleanValue exclusiveSolo;
    private SettableEnumValue mixerWidth;
    private SettableEnumValue mixerPosition;
    private SettableStringValue sectionOrder;
    private SettableStringValue panelTitle;
    private SettableStringValue panelSubtitle;
    private Transport transport;
    private Application application;
    private BeatTimeFormatter positionFormatter;
    private BridgeServer server;
    private boolean running;
    private boolean snapshotFailed;
    private volatile String stateJson = "{\"protocol\":1,\"connected\":false}";
    private int syncedRemotePage = -1;

    PerformancePanelExtension(
        final PerformancePanelExtensionDefinition definition,
        final ControllerHost host) {
        super(definition, host);
        this.host = host;
    }

    @Override
    public void init() {
        track = host.createCursorTrack("performance-panel-track", "Performance Panel Track", 0, 0, true);
        interest(track.color());
        device = track.createCursorDevice(
            "performance-panel-device",
            "Performance Panel Device",
            0,
            com.bitwig.extension.controller.api.CursorDeviceFollowMode.FOLLOW_SELECTION);
        trackBank = host.createTrackBank(TRACK_SCAN_LIMIT, 0, 0, true);
        effectTrackBank = host.createEffectTrackBank(TRACK_SCAN_LIMIT, 0, 0);
        masterTrack = host.createMasterTrack(0);
        transport = host.createTransport();
        positionFormatter = host.createBeatTimeFormatter(".", 1, 1, 1, 2);
        application = host.createApplication();
        includeGroups = host.getPreferences().getBooleanSetting("Include Group Tracks", "Navigation", true);
        includeEffectTracks = host.getPreferences().getBooleanSetting("Include FX Tracks", "Navigation", true);
        includeMasterTrack = host.getPreferences().getBooleanSetting("Include Master Track", "Navigation", true);
        bankLayout = host.getDocumentState().getEnumSetting(
            "Saved Bank Layout", "Performance Panel", new String[] {"Linear", "Rectangular"}, "Linear");
        bankSize = host.getDocumentState().getEnumSetting(
            "Saved Bank Size", "Performance Panel", new String[] {"Large", "Medium", "Small"}, "Large");
        useTrackColor = host.getDocumentState().getBooleanSetting(
            "Use Track Color", "Performance Panel", false);
        showTransportBar = host.getDocumentState().getBooleanSetting(
            "Show Transport Bar", "Performance Panel", true);
        showRemoteControls = host.getDocumentState().getBooleanSetting(
            "Show Remote Controls", "Performance Panel", true);
        remoteControlsPosition = host.getDocumentState().getEnumSetting(
            "Remote Controls Position", "Performance Panel", new String[] {"Top", "Bottom"}, "Top");
        showMixer = host.getDocumentState().getBooleanSetting(
            "Show Mixer", "Performance Panel", false);
        exclusiveSolo = host.getDocumentState().getBooleanSetting(
            "Exclusive Solo", "Performance Panel", false);
        mixerWidth = host.getDocumentState().getEnumSetting(
            "Mixer Width", "Performance Panel", new String[] {"Full", "Half", "Quarter"}, "Full");
        mixerPosition = host.getDocumentState().getEnumSetting(
            "Mixer Position", "Performance Panel", new String[] {"Top", "Mid", "Bottom", "Banks"}, "Mid");
        sectionOrder = host.getDocumentState().getStringSetting(
            "Compact Section Order", "Performance Panel", 512, defaultSectionOrder());
        panelTitle = host.getDocumentState().getStringSetting(
            "Panel Name", "Performance Panel", 48, "Performance Panel");
        panelSubtitle = host.getDocumentState().getStringSetting(
            "Subtitle", "Performance Panel", 64, "BITWIG PERFORMANCE SURFACE");
        interest(includeGroups);
        interest(includeEffectTracks);
        interest(includeMasterTrack);
        interest(bankLayout);
        interest(bankSize);
        interest(useTrackColor);
        interest(showTransportBar);
        interest(showRemoteControls);
        interest(remoteControlsPosition);
        interest(showMixer);
        interest(exclusiveSolo);
        interest(mixerWidth);
        interest(mixerPosition);
        interest(sectionOrder);
        interest(panelTitle);
        interest(panelSubtitle);
        interest(transport.isPlaying());
        interest(transport.isArrangerRecordEnabled());
        interest(transport.isArrangerLoopEnabled());
        interest(transport.isMetronomeEnabled());
        interest(transport.tempo());
        interest(transport.tempo().value());
        interest(transport.tempo().displayedValue());
        interest(transport.playPosition());
        interest(transport.timeSignature());
        deviceBank = device.deviceChain().createDeviceBank(DEVICE_SCAN_LIMIT);
        for (int page = 0; page < PAGE_STACK_COUNT; ++page) {
            final CursorRemoteControlsPage remotePage = device.createCursorRemoteControlsPage(
                "performance-panel-remotes-" + page,
                REMOTE_COUNT,
                "");
            interest(remotePage.getName());
            interest(remotePage.selectedPageIndex());
            interest(remotePage.pageCount());
            interest(remotePage.pageNames());
            for (int control = 0; control < REMOTE_COUNT; ++control) {
                prepareParameter(remotePage.getParameter(control));
            }
            remotePages.add(remotePage);
        }
        remotes = remotePages.get(0);
        interest(track.name());
        interest(track.channelId());
        interest(track.position());
        interest(trackBank.channelCount());
        interest(effectTrackBank.channelCount());
        interest(masterTrack.exists());
        interest(device.name());
        interest(device.position());
        interest(deviceBank.itemCount());
        interest(device.presetName());
        for (int i = 0; i < SAVED_BANK_COUNT; ++i) {
            savedBanks.add(new SavedRemoteBank(host, i));
        }
        for (int i = 0; i < MIXER_TRACK_COUNT; ++i) {
            mixerChannels.add(new MixerChannel(host, i, masterTrack));
        }
        for (int i = 0; i < TRACK_SCAN_LIMIT; ++i) {
            final Track scannedTrack = trackBank.getItemAt(i);
            prepareTrackEntry(scannedTrack, TrackKind.MAIN);
        }
        for (int i = 0; i < TRACK_SCAN_LIMIT; ++i) {
            final Track effectTrack = effectTrackBank.getItemAt(i);
            prepareTrackEntry(effectTrack, TrackKind.EFFECT);
        }
        prepareTrackEntry(masterTrack, TrackKind.MASTER);
        for (int i = 0; i < DEVICE_SCAN_LIMIT; ++i) {
            final BooleanValue match = deviceBank.getItemAt(i).createEqualsValue(device);
            interest(match);
            deviceMatches.add(match);
        }
        try {
            server = new BridgeServer(PORT, () -> stateJson, commands);
            server.start();
            running = true;
            host.scheduleTask(this::bridgeTick, 50);
            host.println("Performance Panel bridge: http://127.0.0.1:" + PORT);
            host.showPopupNotification("Performance Panel bridge ready");
        } catch (final Exception error) {
            host.errorln("Performance Panel bridge failed: " + error.getMessage());
            host.showPopupNotification(
                "Performance Panel could not open 127.0.0.1:" + PORT + ". Check for another active copy.");
        }
    }

    @Override
    public void flush() {
        // Browser state and queued commands are serviced by bridgeTick.
    }

    @Override
    public void exit() {
        running = false;
        if (server != null) server.close();
        host.println("Performance Panel stopped");
    }

    private void bridgeTick() {
        if (!running) return;
        drainCommands();
        if (server.consumeStateRequest()) refreshState();
        host.scheduleTask(this::bridgeTick, 50);
    }

    private void refreshState() {
        try {
            stateJson = snapshot();
            snapshotFailed = false;
        } catch (final RuntimeException error) {
            if (!snapshotFailed) {
                host.errorln("Performance Panel state unavailable; retrying: " + error.getMessage());
                snapshotFailed = true;
            }
        }
    }

    private void drainCommands() {
        Command command;
        while ((command = commands.poll()) != null) execute(command);
    }

    private void execute(final Command command) {
        try {
            switch (command.action()) {
                case "set-remote" -> setNormalized(remote(command.page(), command.index()), command.value());
                case "previous-page" -> remotes.selectPreviousPage(true);
                case "next-page" -> remotes.selectNextPage(true);
                case "previous-track" -> navigateTrack(-1);
                case "next-track" -> navigateTrack(1);
                case "previous-device" -> navigateDevice(-1);
                case "next-device" -> navigateDevice(1);
                case "add-bank" -> saveCurrentBank(command.bank());
                case "release-bank" -> savedBank(command.bank()).release();
                case "set-bank-remote" -> setNormalized(
                    savedBank(command.bank()).remote(command.page(), command.index()),
                    command.value());
                case "set-include-groups" -> includeGroups.set(command.value() >= 0.5);
                case "set-include-effect-tracks" -> includeEffectTracks.set(command.value() >= 0.5);
                case "set-include-master-track" -> includeMasterTrack.set(command.value() >= 0.5);
                case "set-bank-view" -> setBankView(command.value());
                case "set-use-track-color" -> useTrackColor.set(command.value() >= 0.5);
                case "set-show-transport-bar" -> showTransportBar.set(command.value() >= 0.5);
                case "set-show-remote-controls" -> showRemoteControls.set(command.value() >= 0.5);
                case "set-remote-controls-position" -> remoteControlsPosition.set(
                    command.value() >= 0.5 ? "Bottom" : "Top");
                case "set-show-mixer" -> showMixer.set(command.value() >= 0.5);
                case "set-exclusive-solo" -> exclusiveSolo.set(command.value() >= 0.5);
                case "set-mixer-width" -> setMixerWidth(command.value());
                case "set-mixer-position" -> setMixerPosition(command.value());
                case "set-section-order" -> sectionOrder.set(command.text());
                case "add-mixer-track" -> addMixerTrack(track);
                case "add-mixer-all" -> addAllMixerTracks();
                case "release-mixer-track" -> mixerChannel(command.index()).release();
                case "set-mixer-volume" -> mixerChannel(command.index()).setVolume(command.value());
                case "set-mixer-pan" -> mixerChannel(command.index()).setPan(command.value());
                case "set-mixer-mute" -> mixerChannel(command.index()).setMute(command.value() >= 0.5);
                case "set-mixer-solo" -> mixerChannel(command.index()).setSolo(
                    command.value() >= 0.5,
                    exclusiveSolo.get());
                case "set-mixer-arm" -> mixerChannel(command.index()).setArm(command.value() >= 0.5);
                case "set-panel-title" -> panelTitle.set(command.text().trim());
                case "set-panel-subtitle" -> panelSubtitle.set(command.text().trim());
                case "transport-play" -> transport.play();
                case "transport-stop" -> transport.stop();
                case "transport-record" -> transport.record();
                case "transport-loop" -> transport.isArrangerLoopEnabled().set(
                    !transport.isArrangerLoopEnabled().get());
                case "transport-metronome" -> transport.isMetronomeEnabled().set(
                    !transport.isMetronomeEnabled().get());
                case "set-tempo" -> transport.tempo().setRaw(Math.max(20.0, Math.min(666.0, command.value())));
                case "undo" -> application.undo();
                case "redo" -> application.redo();
                default -> host.errorln("Performance Panel ignored command: " + command.action());
            }
        } catch (final RuntimeException error) {
            host.errorln("Performance Panel command failed: " + error.getMessage());
        }
    }

    private RemoteControl remote(final int page, final int index) {
        if (page < 0 || page >= remotePages.size()) throw new IllegalArgumentException("Remote page out of range");
        if (index < 0 || index >= REMOTE_COUNT) throw new IllegalArgumentException("Remote index out of range");
        return remotePages.get(page).getParameter(index);
    }

    private void setBankView(final double value) {
        if (value >= 1.5) {
            bankLayout.set("Rectangular");
            bankSize.set("Small");
        } else if (value >= 0.5) {
            bankLayout.set("Rectangular");
            bankSize.set("Medium");
        } else {
            bankLayout.set("Linear");
            bankSize.set("Large");
        }
    }

    private void setMixerPosition(final double value) {
        if (value >= 2.5) mixerPosition.set("Banks");
        else if (value >= 1.5) mixerPosition.set("Bottom");
        else if (value >= 0.5) mixerPosition.set("Mid");
        else mixerPosition.set("Top");
    }

    private void setMixerWidth(final double value) {
        if (value >= 1.5) mixerWidth.set("Quarter");
        else if (value >= 0.5) mixerWidth.set("Half");
        else mixerWidth.set("Full");
    }

    private MixerChannel mixerChannel(final int index) {
        if (index < 0 || index >= mixerChannels.size()) throw new IllegalArgumentException("Mixer channel index out of range");
        return mixerChannels.get(index);
    }

    private void addMixerTrack(final Track source) {
        final String sourceId = source.channelId().get();
        if (!sourceId.isBlank()) {
            for (final MixerChannel channel : mixerChannels) {
                if (channel.isPinned() && sourceId.equals(channel.channelId())) return;
            }
        }
        for (final MixerChannel channel : mixerChannels) {
            if (!channel.isPinned()) {
                channel.pinFrom(source);
                return;
            }
        }
        throw new IllegalStateException("All mixer channel slots are in use");
    }

    private void addAllMixerTracks() {
        final List<MixerChannel> available = new ArrayList<>();
        final var pinnedIds = new java.util.HashSet<String>();
        for (final MixerChannel channel : mixerChannels) {
            if (channel.isPinned()) {
                if (!channel.channelId().isBlank()) pinnedIds.add(channel.channelId());
            } else {
                available.add(channel);
            }
        }
        int slot = 0;
        for (final TrackEntry entry : navigableTrackEntries()) {
            final String id = entry.track().channelId().get();
            if (!id.isBlank() && !pinnedIds.add(id)) continue;
            if (slot >= available.size()) return;
            available.get(slot++).pinFrom(entry.track());
        }
    }

    private void setNormalized(final Parameter parameter, final double value) {
        parameter.touch(true);
        parameter.value().setImmediately(clamp(value));
        host.scheduleTask(() -> parameter.touch(false), 50);
    }

    private void navigateTrack(final int direction) {
        final List<TrackEntry> entries = navigableTrackEntries();
        if (entries.isEmpty()) return;
        final int selectedIndex = selectedTrackEntryIndex(entries);
        final int targetIndex = selectedIndex < 0
            ? direction < 0 ? entries.size() - 1 : 0
            : Math.floorMod(selectedIndex + direction, entries.size());
        track.selectChannel(entries.get(targetIndex).track());
    }

    private void navigateDevice(final int direction) {
        final int count = Math.min(deviceBank.itemCount().get(), DEVICE_SCAN_LIMIT);
        if (count <= 0) return;
        final int targetIndex = Math.floorMod(device.position().get() + direction, count);
        device.selectDevice(deviceBank.getItemAt(targetIndex));
    }

    private void prepareTrackEntry(final Track candidate, final TrackKind kind) {
        interest(candidate.exists());
        interest(candidate.isGroup());
        interest(candidate.channelId());
        final BooleanValue match = candidate.createEqualsValue(track);
        interest(match);
        trackEntries.add(new TrackEntry(candidate, match, kind));
    }

    private boolean isNavigable(final TrackEntry entry) {
        if (!entry.track().exists().get()) return false;
        return switch (entry.kind()) {
            case MAIN -> includeGroups.get() || !entry.track().isGroup().get();
            case EFFECT -> includeEffectTracks.get();
            case MASTER -> includeMasterTrack.get();
        };
    }

    private List<TrackEntry> navigableTrackEntries() {
        final var unique = new LinkedHashMap<String, TrackEntry>();
        int fallback = 0;
        for (final TrackEntry entry : trackEntries) {
            if (!entry.track().exists().get()) continue;
            final String channelId = entry.track().channelId().get();
            final String key = channelId.isBlank() ? "entry:" + fallback++ : "channel:" + channelId;
            final TrackEntry existing = unique.get(key);
            if (existing == null || trackKindPriority(entry.kind()) > trackKindPriority(existing.kind())) {
                unique.put(key, entry);
            }
        }
        return unique.values().stream().filter(this::isNavigable).toList();
    }

    private static int trackKindPriority(final TrackKind kind) {
        return switch (kind) {
            case MAIN -> 0;
            case EFFECT -> 1;
            case MASTER -> 2;
        };
    }

    private static int selectedTrackEntryIndex(final List<TrackEntry> entries) {
        for (int index = 0; index < entries.size(); ++index) {
            if (entries.get(index).match().get()) return index;
        }
        return -1;
    }

    private int selectedNavigableTrackIndex() {
        final int index = selectedTrackEntryIndex(navigableTrackEntries());
        return index < 0 ? 0 : index + 1;
    }

    private int navigableTrackCount() {
        return navigableTrackEntries().size();
    }

    private SavedRemoteBank savedBank(final int index) {
        if (index < 0 || index >= savedBanks.size()) throw new IllegalArgumentException("Saved bank index out of range");
        return savedBanks.get(index);
    }

    private void saveCurrentBank(final int requestedIndex) {
        if (requestedIndex >= 0) {
            savedBank(requestedIndex).pinFrom(remotes);
            return;
        }
        for (final SavedRemoteBank bank : savedBanks) {
            if (!bank.isPinned()) {
                bank.pinFrom(remotes);
                return;
            }
        }
        throw new IllegalStateException("All saved bank slots are in use");
    }

    private String snapshot() {
        syncRemotePages();
        final StringBuilder json = new StringBuilder(8192);
        json.append("{\"protocol\":1,\"connected\":true,");
        field(json, "build", PerformancePanelExtensionDefinition.VERSION);
        json.append(",\"host\":{");
        field(json, "product", host.getHostProduct()).append(',');
        field(json, "version", host.getHostVersion()).append(',');
        json.append("\"api\":").append(host.getHostApiVersion()).append('}');

        json.append(",\"selected\":{");
        field(json, "track", text(track.name().get())).append(',');
        final var selectedTrackColor = track.color().get();
        field(json, "trackColor", selectedTrackColor == null ? "" : selectedTrackColor.toHex()).append(',');
        json.append("\"trackIndex\":").append(selectedNavigableTrackIndex()).append(',');
        json.append("\"trackCount\":").append(navigableTrackCount()).append(',');
        field(json, "device", text(device.name().get())).append(',');
        json.append("\"deviceIndex\":").append(matchedIndex(deviceMatches, device.position().get())).append(',');
        json.append("\"deviceCount\":").append(deviceBank.itemCount().get()).append(',');
        field(json, "preset", text(device.presetName().get())).append(',');
        json.append("\"presetIndex\":0,");
        json.append("\"presetCount\":0,");
        field(json, "page", text(remotes.getName().get())).append(',');
        json.append("\"pageIndex\":").append(remotes.selectedPageIndex().get() + 1).append(',');
        json.append("\"pageCount\":").append(remotes.pageCount().get()).append('}');

        json.append(",\"settings\":{");
        json.append("\"includeGroups\":").append(includeGroups.get()).append(',');
        json.append("\"includeEffectTracks\":").append(includeEffectTracks.get()).append(',');
        json.append("\"includeMasterTrack\":").append(includeMasterTrack.get()).append(',');
        field(json, "bankLayout", bankLayout.get().toLowerCase(Locale.ROOT)).append(',');
        field(json, "bankSize", bankSize.get().toLowerCase(Locale.ROOT)).append(',');
        field(json, "bankView", bankView()).append(',');
        json.append("\"useTrackColor\":").append(useTrackColor.get()).append(',');
        json.append("\"showTransportBar\":").append(showTransportBar.get()).append(',');
        json.append("\"showRemoteControls\":").append(showRemoteControls.get()).append(',');
        field(json, "remoteControlsPosition", remoteControlsPosition.get().toLowerCase(Locale.ROOT)).append(',');
        json.append("\"showMixer\":").append(showMixer.get()).append(',');
        json.append("\"exclusiveSolo\":").append(exclusiveSolo.get()).append(',');
        field(json, "mixerWidth", mixerWidth.get().toLowerCase(Locale.ROOT)).append(',');
        field(json, "mixerPosition", mixerPosition.get().toLowerCase(Locale.ROOT)).append(',');
        field(json, "sectionOrder", sectionOrder.get()).append(',');
        field(json, "panelTitle", panelTitle.get()).append(',');
        field(json, "panelSubtitle", panelSubtitle.get()).append('}');

        json.append(",\"transport\":{");
        json.append("\"playing\":").append(transport.isPlaying().get()).append(',');
        json.append("\"recording\":").append(transport.isArrangerRecordEnabled().get()).append(',');
        json.append("\"loop\":").append(transport.isArrangerLoopEnabled().get()).append(',');
        json.append("\"metronome\":").append(transport.isMetronomeEnabled().get()).append(',');
        json.append("\"tempo\":").append(format(transport.tempo().getRaw())).append(',');
        field(json, "position", transport.playPosition().getFormatted(positionFormatter)).append(',');
        field(json, "timeSignature", transport.timeSignature().get()).append('}');

        json.append(",\"remotes\":[");
        for (int i = 0; i < REMOTE_COUNT; ++i) {
            if (i > 0) json.append(',');
            parameter(json, i, remotes.getParameter(i), true);
        }
        json.append(']');

        json.append(",\"remotePages\":[");
        appendRemotePages(json, remotePages, remotes.selectedPageIndex().get() + 1, remotes.pageCount().get());
        json.append(']');

        json.append(",\"savedBankCapacity\":").append(SAVED_BANK_COUNT);
        json.append(",\"savedBanks\":[");
        boolean firstSavedBank = true;
        for (int bankIndex = 0; bankIndex < savedBanks.size(); ++bankIndex) {
            final SavedRemoteBank bank = savedBanks.get(bankIndex);
            if (!bank.isPinned()) continue;
            if (!firstSavedBank) json.append(',');
            firstSavedBank = false;
            json.append('{').append("\"index\":").append(bank.index()).append(',');
            json.append("\"pinned\":").append(bank.isPinned()).append(',');
            json.append("\"exists\":").append(bank.exists()).append(',');
            field(json, "track", text(bank.trackName())).append(',');
            field(json, "trackPath", text(bank.trackPath())).append(',');
            field(json, "trackColor", text(bank.trackColor())).append(',');
            field(json, "device", text(bank.deviceName())).append(',');
            field(json, "page", text(bank.pageName())).append(',');
            json.append("\"pageIndex\":").append(bank.pageIndex()).append(',');
            json.append("\"pageCount\":").append(bank.pageCount()).append(',');
            json.append("\"remotes\":[");
            for (int control = 0; control < SavedRemoteBank.CONTROL_COUNT; ++control) {
                if (control > 0) json.append(',');
                parameter(json, control, bank.remote(0, control), true);
            }
            json.append("],\"remotePages\":[");
            for (int page = 0; page < SavedRemoteBank.PAGE_STACK_COUNT; ++page) {
                if (page > 0) json.append(',');
                appendRemotePage(json, page, bank.page(page), bank.pageAvailable(page));
            }
            json.append("]}");
        }
        json.append(']');

        json.append(",\"mixer\":{\"channels\":[");
        boolean firstMixerChannel = true;
        for (final MixerChannel channel : mixerChannels) {
            if (!channel.isPinned()) continue;
            if (!firstMixerChannel) json.append(',');
            firstMixerChannel = false;
            json.append('{').append("\"index\":").append(channel.index()).append(',');
            json.append("\"pinned\":").append(channel.isPinned()).append(',');
            json.append("\"exists\":").append(channel.exists()).append(',');
            field(json, "name", text(channel.name())).append(',');
            field(json, "path", text(channel.path())).append(',');
            field(json, "color", text(channel.color())).append(',');
            field(json, "kind", mixerTrackKind(channel)).append(',');
            json.append("\"trackNumber\":").append(mixerTrackNumber(channel)).append(',');
            json.append("\"volume\":").append(format(channel.volume())).append(',');
            field(json, "volumeDisplay", text(channel.volumeDisplay())).append(',');
            json.append("\"pan\":").append(format(channel.pan())).append(',');
            field(json, "panDisplay", text(channel.panDisplay())).append(',');
            json.append("\"mute\":").append(channel.mute()).append(',');
            json.append("\"solo\":").append(channel.solo()).append(',');
            json.append("\"arm\":").append(channel.arm()).append(',');
            json.append("\"master\":").append(channel.isMaster()).append(',');
            json.append("\"meter\":").append(format(channel.meter())).append('}');
        }
        json.append("]}");

        json.append(",\"modulators\":{\"available\":false,\"items\":[]}");

        return json.append('}').toString();
    }

    private void syncRemotePages() {
        final int basePage = remotes.selectedPageIndex().get();
        if (basePage == syncedRemotePage) return;
        syncedRemotePage = basePage;
        for (int page = 1; page < remotePages.size(); ++page) {
            remotePages.get(page).selectedPageIndex().set(basePage + page);
        }
    }

    private static void appendRemotePages(
        final StringBuilder json,
        final List<CursorRemoteControlsPage> pages,
        final int basePage,
        final int pageCount) {
        for (int page = 0; page < pages.size(); ++page) {
            if (page > 0) json.append(',');
            appendRemotePage(json, page, pages.get(page), basePage + page <= pageCount);
        }
    }

    private static void appendRemotePage(
        final StringBuilder json,
        final int offset,
        final CursorRemoteControlsPage page,
        final boolean available) {
        json.append('{').append("\"offset\":").append(offset).append(',');
        json.append("\"available\":").append(available).append(',');
        field(json, "name", text(page.getName().get())).append(',');
        json.append("\"pageIndex\":").append(page.selectedPageIndex().get() + 1).append(',');
        json.append("\"remotes\":[");
        for (int control = 0; control < REMOTE_COUNT; ++control) {
            if (control > 0) json.append(',');
            parameter(json, control, page.getParameter(control), true);
        }
        json.append("]}");
    }

    private static void parameter(
        final StringBuilder json,
        final int index,
        final Parameter parameter,
        final boolean includeIndex) {
        json.append('{');
        if (includeIndex) json.append("\"index\":").append(index).append(',');
        parameterBody(json, parameter);
        json.append('}');
    }

    private static void parameterBody(final StringBuilder json, final Parameter parameter) {
        json.append("\"exists\":").append(parameter.exists().get()).append(',');
        field(json, "name", text(parameter.name().get())).append(',');
        field(json, "display", text(parameter.displayedValue().get())).append(',');
        json.append("\"value\":").append(format(clamp(parameter.value().get())));
    }

    private static StringBuilder field(final StringBuilder json, final String name, final String value) {
        return json.append('"').append(escape(name)).append("\":\"").append(escape(value)).append('"');
    }

    private static String escape(final String value) {
        if (value == null) return "";
        final StringBuilder escaped = new StringBuilder(value.length() + 8);
        for (int i = 0; i < value.length(); ++i) {
            final char c = value.charAt(i);
            switch (c) {
                case '"' -> escaped.append("\\\"");
                case '\\' -> escaped.append("\\\\");
                case '\n' -> escaped.append("\\n");
                case '\r' -> escaped.append("\\r");
                case '\t' -> escaped.append("\\t");
                default -> {
                    if (c < 0x20) escaped.append(String.format("\\u%04x", (int)c));
                    else escaped.append(c);
                }
            }
        }
        return escaped.toString();
    }

    private static String text(final String value) { return value == null ? "" : value; }
    private String bankView() {
        if (!"Rectangular".equals(bankLayout.get())) return "linear";
        return "Small".equals(bankSize.get()) ? "compact" : "grid";
    }
    private static int matchedIndex(final List<BooleanValue> matches, final int fallback) {
        for (int i = 0; i < matches.size(); ++i) {
            if (matches.get(i).get()) return i + 1;
        }
        return fallback + 1;
    }
    private int mixerTrackNumber(final MixerChannel channel) {
        final String channelId = channel.channelId();
        final List<TrackEntry> entries = navigableTrackEntries();
        if (!channelId.isBlank()) {
            for (int index = 0; index < entries.size(); ++index) {
                if (channelId.equals(entries.get(index).track().channelId().get())) return index + 1;
            }
        }
        return Math.max(1, channel.position() + 1);
    }
    private String mixerTrackKind(final MixerChannel channel) {
        final String channelId = channel.channelId();
        TrackEntry bestMatch = null;
        if (!channelId.isBlank()) {
            for (final TrackEntry entry : trackEntries) {
                if (!entry.track().exists().get() || !channelId.equals(entry.track().channelId().get())) continue;
                if (bestMatch == null || trackKindPriority(entry.kind()) > trackKindPriority(bestMatch.kind())) {
                    bestMatch = entry;
                }
            }
        }
        if (bestMatch == null) return channel.isMaster() ? "master" : "track";
        return switch (bestMatch.kind()) {
            case MASTER -> "master";
            case EFFECT -> "effect";
            case MAIN -> bestMatch.track().isGroup().get() ? "group" : "track";
        };
    }
    private static double clamp(final double value) { return Math.max(0.0, Math.min(1.0, value)); }
    private static String format(final double value) { return String.format(Locale.ROOT, "%.6f", value); }

    private static String defaultSectionOrder() {
        final StringBuilder order = new StringBuilder("mixer");
        for (int index = 0; index < SAVED_BANK_COUNT; ++index) order.append(",bank:").append(index);
        return order.toString();
    }

    private static void prepareParameter(final Parameter parameter) {
        interest(parameter.name());
        interest(parameter.value());
        interest(parameter.modulatedValue());
        interest(parameter.displayedValue());
        interest(parameter.exists());
    }

    private static void interest(final com.bitwig.extension.controller.api.Value<?> value) {
        value.markInterested();
    }

    private enum TrackKind { MAIN, EFFECT, MASTER }
    private record TrackEntry(Track track, BooleanValue match, TrackKind kind) {}
}
