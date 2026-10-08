package com.spendwise.app;

import android.content.Context;
import android.content.res.Configuration;
import android.os.Bundle;

import androidx.core.splashscreen.SplashScreen;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void attachBaseContext(Context base) {
        // Older AppCompat needs its local mode before it resolves splash resources.
        // This phase must never fetch a service through the unattached Activity.
        SpendWiseAppearance.restoreBeforeAttachment(base);
        super.attachBaseContext(base);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Activity attachment is complete; Android 12+ uses the initialized
        // application context rather than ContextImpl's outer Activity wrapper.
        SpendWiseAppearance.restoreAfterAttachment(getApplicationContext());
        SplashScreen.installSplashScreen(this);
        registerPlugin(SpendWiseSecurityPlugin.class);
        registerPlugin(SpendWiseAppearancePlugin.class);
        registerPlugin(SpendWiseAcquisitionPlugin.class);
        super.onCreate(savedInstanceState);
        SpendWiseAppearance.applySurfaces(this, getBridge());
    }

    @Override
    public void onConfigurationChanged(Configuration configuration) {
        super.onConfigurationChanged(configuration);
        SpendWiseAppearance.applySurfaces(this, getBridge());
    }
}
