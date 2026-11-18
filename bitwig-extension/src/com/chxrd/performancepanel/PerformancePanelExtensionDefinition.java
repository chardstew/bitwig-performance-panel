package com.chxrd.performancepanel;

import java.util.UUID;

import com.bitwig.extension.api.PlatformType;
import com.bitwig.extension.controller.AutoDetectionMidiPortNamesList;
import com.bitwig.extension.controller.ControllerExtension;
import com.bitwig.extension.controller.ControllerExtensionDefinition;
import com.bitwig.extension.controller.api.ControllerHost;

public final class PerformancePanelExtensionDefinition extends ControllerExtensionDefinition {
    private static final UUID ID = UUID.fromString("72d9da36-0c52-4f63-a5f1-7931c928ee20");
    static final String VERSION = "0.1.0-alpha.6";

    @Override
    public String getName() { return "Performance Panel"; }

    @Override
    public String getAuthor() { return "CHXRD"; }

    @Override
    public String getVersion() { return VERSION; }

    @Override
    public UUID getId() { return ID; }

    @Override
    public int getRequiredAPIVersion() { return 20; }

    @Override
    public String getHardwareVendor() { return "CHXRD"; }

    @Override
    public String getHardwareModel() { return "Performance Panel"; }

    @Override
    public int getNumMidiInPorts() { return 0; }

    @Override
    public int getNumMidiOutPorts() { return 0; }

    @Override
    public void listAutoDetectionMidiPortNames(
        final AutoDetectionMidiPortNamesList list,
        final PlatformType platformType) {
        // Network companion: no MIDI ports or auto-detection.
    }

    @Override
    public ControllerExtension createInstance(final ControllerHost host) {
        return new PerformancePanelExtension(this, host);
    }
}
