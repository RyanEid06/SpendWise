package com.spendwise.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SpendWiseAppearance")
public class SpendWiseAppearancePlugin extends Plugin {
    @PluginMethod
    public void setThemeMode(PluginCall call) {
        String mode = call.getString("mode");
        if (!SpendWiseAppearance.isValidMode(mode)) {
            call.reject("Invalid theme mode.", "INVALID_THEME_MODE");
            return;
        }
        getActivity().runOnUiThread(() -> {
            if (!SpendWiseAppearance.saveMode(getContext(), mode)) {
                call.reject("Appearance preference could not be saved.", "APPEARANCE_SAVE_FAILED");
                return;
            }
            SpendWiseAppearance.applyNightMode(getContext(), mode);
            SpendWiseAppearance.applySurfaces(getActivity(), getBridge());
            JSObject result = new JSObject();
            result.put("mode", mode);
            call.resolve(result);
        });
    }
}
