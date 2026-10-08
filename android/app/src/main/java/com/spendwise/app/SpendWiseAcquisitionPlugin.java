package com.spendwise.app;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.IOException;
import android.net.Uri;

/** Only owns ION Camera's direct-child internal cache copies, never gallery originals. */
@CapacitorPlugin(name = "SpendWiseAcquisition")
public class SpendWiseAcquisitionPlugin extends Plugin {
    @PluginMethod
    public void dispose(PluginCall call) {
        try {
            String path = call.getString("path", "");
            if (path.startsWith("file://")) path = Uri.parse(path).getPath();
            File cache = getContext().getCacheDir().getCanonicalFile();
            File candidate = new File(path).getCanonicalFile();
            // content:// URIs, shared/public files and private permanent media stay untouched.
            if (cache.equals(candidate.getParentFile()) && candidate.isFile() && !candidate.delete()) {
                throw new IOException("ACQUISITION_DISPOSAL_FAILED");
            }
            call.resolve();
        } catch (Exception error) { call.reject("ACQUISITION_DISPOSAL_FAILED"); }
    }

    @PluginMethod
    public void cleanup(PluginCall call) {
        try {
            cleanup(getContext().getCacheDir());
            call.resolve();
        } catch (Exception error) { call.reject("ACQUISITION_CLEANUP_FAILED"); }
    }

    static void cleanup(File root) throws IOException {
        File canonical = root.getCanonicalFile();
        File[] files = root.listFiles();
        if (files == null) return;
        for (File file : files) {
            String name = file.getName();
            // Verified against ioncamera-android 1.0.2 source. No recursive sweep;
            // exported backups, WebView cache, media .swm and user files are excluded.
            boolean owned = name.matches("(?:(?:\\.Pic|(?:PIC|IMG)_\\d{8}_\\d{6})\\.(?:jpg|jpeg|png)|[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}\\.[a-zA-Z0-9]{1,10})");
            File target = file.getCanonicalFile();
            if (owned && canonical.equals(target.getParentFile()) && target.isFile() && !target.delete()) {
                throw new IOException("ACQUISITION_CLEANUP_FAILED");
            }
        }
    }
}
