package com.spendwise.app;

import android.app.Activity;
import android.app.UiModeManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.content.res.Resources;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.view.Window;

import androidx.appcompat.app.AppCompatDelegate;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.Bridge;

/** Only the non-sensitive appearance preference is mirrored before protected storage opens. */
final class SpendWiseAppearance {
    private static final String PREFERENCES = "spendwise.appearance";
    private static final String MODE_KEY = "mode";

    static boolean isValidMode(String mode) {
        return "LIGHT".equals(mode) || "DARK".equals(mode) || "SYSTEM".equals(mode);
    }

    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    }

    static String readMode(Context context) {
        String mode;
        try {
            mode = preferences(context).getString(MODE_KEY, "SYSTEM");
        } catch (ClassCastException invalidMirror) {
            return "SYSTEM";
        }
        return isValidMode(mode) ? mode : "SYSTEM";
    }

    static boolean saveMode(Context context, String mode) {
        return isValidMode(mode) && preferences(context).edit().putString(MODE_KEY, mode).commit();
    }

    static void restoreBeforeActivity(Context context) {
        applyNightMode(context, readMode(context));
    }

    static void applyNightMode(Context context, String mode) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            UiModeManager manager = (UiModeManager) context.getSystemService(Context.UI_MODE_SERVICE);
            if (manager != null) {
                // AUTO clears the app-specific night qualifier and follows the device.
                // Unlike setNightMode(), this never changes the device's global setting.
                int value = "DARK".equals(mode) ? UiModeManager.MODE_NIGHT_YES
                    : "LIGHT".equals(mode) ? UiModeManager.MODE_NIGHT_NO
                    : UiModeManager.MODE_NIGHT_AUTO;
                manager.setApplicationNightMode(value);
            }
        } else {
            int value = "DARK".equals(mode) ? AppCompatDelegate.MODE_NIGHT_YES
                : "LIGHT".equals(mode) ? AppCompatDelegate.MODE_NIGHT_NO
                : AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM;
            AppCompatDelegate.setDefaultNightMode(value);
        }
    }

    static void applySurfaces(Activity activity, Bridge bridge) {
        String mode = readMode(activity);
        boolean systemDark = (Resources.getSystem().getConfiguration().uiMode
            & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        boolean dark = "DARK".equals(mode) || ("SYSTEM".equals(mode) && systemDark);
        // Configuration delivery can follow the plugin call. Resolve qualified colors
        // explicitly so backgrounds and icons change together on the current frame.
        Configuration appearance = new Configuration(activity.getResources().getConfiguration());
        appearance.uiMode = (appearance.uiMode & ~Configuration.UI_MODE_NIGHT_MASK)
            | (dark ? Configuration.UI_MODE_NIGHT_YES : Configuration.UI_MODE_NIGHT_NO);
        Resources resources = activity.createConfigurationContext(appearance).getResources();
        int background = resources.getColor(R.color.spendwise_launch_background);
        int bar = resources.getColor(R.color.spendwise_system_bar);
        Window window = activity.getWindow();
        window.setBackgroundDrawable(new ColorDrawable(background));
        window.setStatusBarColor(bar);
        window.setNavigationBarColor(bar);
        WindowInsetsControllerCompat insets = WindowCompat.getInsetsController(window, window.getDecorView());
        insets.setAppearanceLightStatusBars(!dark);
        insets.setAppearanceLightNavigationBars(!dark);
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().setBackgroundColor(background);
        }
    }
}
