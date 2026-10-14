package com.spendwise.app;

import static org.junit.Assert.*;
import android.content.ComponentName;
import android.content.Context;
import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.content.res.TypedArray;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.view.ContextThemeWrapper;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Resolves compiled resources through the actual manifest, including night
 * qualifiers, without opening a credential prompt or requiring enrolled auth. */
@RunWith(AndroidJUnit4.class)
public class AuthenticationHostThemeTest {
    @Test public void privateHostPreservesUnderlyingSecureSurfaceInDayAndNight() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        ActivityInfo info = context.getPackageManager().getActivityInfo(
            new ComponentName(context, SpendWiseAuthenticationActivity.class), 0);
        assertFalse("Authentication host must remain internal", info.exported);
        assertNotEquals("Manifest must explicitly select the host theme", 0, info.theme);
        for (int night : new int[] { Configuration.UI_MODE_NIGHT_NO, Configuration.UI_MODE_NIGHT_YES }) {
            Configuration config = new Configuration(context.getResources().getConfiguration());
            config.uiMode = (config.uiMode & ~Configuration.UI_MODE_NIGHT_MASK) | night;
            Context themed = new ContextThemeWrapper(context.createConfigurationContext(config), info.getThemeResource());
            TypedArray attributes = themed.obtainStyledAttributes(new int[] {
                android.R.attr.windowActionBar, android.R.attr.windowNoTitle,
                android.R.attr.windowIsTranslucent, android.R.attr.windowIsFloating,
                android.R.attr.backgroundDimEnabled, android.R.attr.windowDisablePreview,
                android.R.attr.windowBackground
            });
            try {
                assertFalse("No native action bar may cover the lock card", attributes.getBoolean(0, true));
                assertTrue(attributes.getBoolean(1, false));
                assertTrue("Existing secure surface stays visible", attributes.getBoolean(2, false));
                assertFalse("Host remains a full-size modal Activity", attributes.getBoolean(3, true));
                assertFalse("OS owns prompt dimming", attributes.getBoolean(4, true));
                assertTrue("No opaque starting preview", attributes.getBoolean(5, false));
                assertTrue(attributes.getDrawable(6) instanceof ColorDrawable);
                assertEquals(Color.TRANSPARENT, ((ColorDrawable) attributes.getDrawable(6)).getColor());
            } finally { attributes.recycle(); }
        }
    }
}
