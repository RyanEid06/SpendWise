package com.spendwise.app;

import android.content.Context;
import android.content.res.Configuration;
import android.os.Bundle;

import androidx.core.splashscreen.SplashScreen;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void attachBaseContext(Context base) {
        // AppCompat resolves qualified splash resources while attaching its base.
        SpendWiseAppearance.restoreBeforeActivity(base);
        super.attachBaseContext(base);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        registerPlugin(SpendWiseSecurityPlugin.class);
        registerPlugin(SpendWiseAppearancePlugin.class);
        super.onCreate(savedInstanceState);
        SpendWiseAppearance.applySurfaces(this, getBridge());
    }

    @Override
    public void onConfigurationChanged(Configuration configuration) {
        super.onConfigurationChanged(configuration);
        SpendWiseAppearance.applySurfaces(this, getBridge());
    }
}
