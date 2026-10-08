import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// These doubles replace Android/Capacitor boundaries only. The compiled launch
// activity, appearance plugin and mode policy are the production Java files.
const stubs: Record<string, string> = {
  'android/os/Build.java': `package android.os; public class Build {
    public static class VERSION { public static int SDK_INT = 31; }
    public static class VERSION_CODES { public static final int S = 31; }
  }`,
  'android/os/Bundle.java': 'package android.os; public class Bundle {}',
  'android/content/res/Configuration.java': `package android.content.res; public class Configuration {
    public static final int UI_MODE_NIGHT_MASK=48, UI_MODE_NIGHT_NO=16, UI_MODE_NIGHT_YES=32;
    public int uiMode=16; public Configuration() {} public Configuration(Configuration c) {uiMode=c.uiMode;}
  }`,
  'android/content/res/Resources.java': `package android.content.res; public class Resources {
    public static final Resources SYSTEM = new Resources(); public Configuration config = new Configuration();
    public static Resources getSystem() {return SYSTEM;} public Configuration getConfiguration() {return config;}
    public int getColor(int id) {return config.uiMode == 32 ? 0xff05080c : 0xfff8fafc;}
  }`,
  'android/content/SharedPreferences.java': `package android.content;
    public interface SharedPreferences { String getString(String k,String d); Editor edit();
      interface Editor { Editor putString(String k,String v); boolean commit(); void apply(); }
    }`,
  'android/content/Context.java': `package android.content;
    import android.content.res.*; import java.util.*;
    public class Context {
      public static final int MODE_PRIVATE=0; public static final String UI_MODE_SERVICE="uimode";
      public static final Map<String,String> values=new HashMap<>();
      public static final Context APPLICATION=new Context();
      public android.app.Activity outer; public static Context lastServiceContext;
      public static boolean durable=true; public Resources resources=new Resources();
      public Object getSystemService(String key) {
        // Android 16 constructs UiModeManager from ContextImpl's outer Activity.
        // Its ContextWrapper base is still null during attachBaseContext entry.
        if(android.os.Build.VERSION.SDK_INT>=36 && outer!=null) outer.getApplicationContext();
        lastServiceContext=this;return android.app.UiModeManager.INSTANCE;
      }
      public Resources getResources() {return resources;}
      public Context getApplicationContext() {return APPLICATION;}
      public Context createConfigurationContext(Configuration c) {Context x=new Context();x.resources.config=c;return x;}
      public SharedPreferences getSharedPreferences(String file,int access) {
        if (!file.equals("spendwise.appearance") || access!=MODE_PRIVATE) throw new AssertionError("appearance must be private");
        return new SharedPreferences() {
          public String getString(String k,String d) {return values.getOrDefault(k,d);}
          public Editor edit() {return new Editor() {
            String key,value; public Editor putString(String k,String v) {key=k;value=v;return this;}
            public boolean commit() {if(durable)values.put(key,value);return durable;}
            public void apply() {throw new AssertionError("must persist before acknowledging");}
          };}
        };
      }
    }`,
  'android/app/UiModeManager.java': `package android.app; public class UiModeManager {
    public static final int MODE_NIGHT_AUTO=0, MODE_NIGHT_NO=1, MODE_NIGHT_YES=2;
    public static final UiModeManager INSTANCE=new UiModeManager(); public int mode=-99;
    public void setApplicationNightMode(int value) {mode=value;}
  }`,
  'android/graphics/drawable/ColorDrawable.java': `package android.graphics.drawable;
    public class ColorDrawable {public final int color; public ColorDrawable(int c){color=c;}}`,
  'android/view/View.java': `package android.view; public class View {
    public int background; public void setBackgroundColor(int color) {background=color;}
  }`,
  'android/view/Window.java': `package android.view; import android.graphics.drawable.ColorDrawable;
    public class Window {public int background,status,navigation,flags=8192; public boolean lightStatus,lightNavigation;
      public View decor=new View(); public View getDecorView(){return decor;}
      public void setBackgroundDrawable(ColorDrawable c){background=c.color;}
      public void setStatusBarColor(int c){status=c;} public void setNavigationBarColor(int c){navigation=c;}
    }`,
  'android/app/Activity.java': `package android.app; import android.content.Context; import android.content.res.Configuration;
    public class Activity extends Context {public boolean attached;public android.view.Window window=new android.view.Window();
      public android.view.Window getWindow(){return window;} public void runOnUiThread(Runnable r){r.run();}
      protected void attachBaseContext(Context base){resources=base.resources;attached=true;}
      public Context getApplicationContext(){if(!attached)throw new NullPointerException("ContextWrapper base is null");return Context.APPLICATION;}
      public void onConfigurationChanged(Configuration c){resources.config=c;}
    }`,
  'androidx/appcompat/app/AppCompatDelegate.java': `package androidx.appcompat.app;
    public class AppCompatDelegate {public static final int MODE_NIGHT_NO=1,MODE_NIGHT_YES=2,MODE_NIGHT_FOLLOW_SYSTEM=-1;
      public static int mode=-99;public static void setDefaultNightMode(int m){mode=m;}}
  `,
  'androidx/core/view/WindowCompat.java': `package androidx.core.view;
    public class WindowCompat {public static WindowInsetsControllerCompat getInsetsController(android.view.Window w,android.view.View v){return new WindowInsetsControllerCompat(w);}}`,
  'androidx/core/view/WindowInsetsControllerCompat.java': `package androidx.core.view;
    public class WindowInsetsControllerCompat {android.view.Window window;
      public WindowInsetsControllerCompat(android.view.Window w){window=w;}
      public void setAppearanceLightStatusBars(boolean v){window.lightStatus=v;}
      public void setAppearanceLightNavigationBars(boolean v){window.lightNavigation=v;}
    }`,
  'androidx/core/splashscreen/SplashScreen.java': `package androidx.core.splashscreen;
    public class SplashScreen {public static void installSplashScreen(android.app.Activity a) {
      com.getcapacitor.BridgeActivity.events.add("splash:"+androidx.appcompat.app.AppCompatDelegate.mode);
      if(android.os.Build.VERSION.SDK_INT>=31) {
        if(!a.attached)throw new AssertionError("modern splash installed before attachment");
        if(android.app.UiModeManager.INSTANCE.mode==-99)throw new AssertionError("modern saved mode not restored before splash");
        com.getcapacitor.BridgeActivity.events.add("splash-modern:"+android.app.UiModeManager.INSTANCE.mode);
      }
    }}`,
  'com/getcapacitor/Bridge.java': `package com.getcapacitor;
    public class Bridge {public android.view.View web=new android.view.View();public android.view.View getWebView(){return web;}}`,
  'com/getcapacitor/BridgeActivity.java': `package com.getcapacitor;
    public class BridgeActivity extends android.app.Activity {
      public static java.util.List<String> events=new java.util.ArrayList<>(); protected Bridge bridge=new Bridge();
      protected void attachBaseContext(android.content.Context base) {
        events.add("attach:"+androidx.appcompat.app.AppCompatDelegate.mode);super.attachBaseContext(base);
      }
      public void onCreate(android.os.Bundle b){events.add("create");}
      public void registerPlugin(Class<?> c){events.add(c.getSimpleName());}public Bridge getBridge(){return bridge;}
    }`,
  'com/getcapacitor/Plugin.java': `package com.getcapacitor;
    public class Plugin {public android.app.Activity activity; public android.app.Activity getActivity(){return activity;}
      public android.content.Context getContext(){return activity;} public Bridge getBridge(){return ((BridgeActivity)activity).getBridge();}}`,
  'com/getcapacitor/PluginCall.java': `package com.getcapacitor;
    public class PluginCall {public String mode;public String error;public JSObject result;
      public PluginCall(String m){mode=m;}public String getString(String k){return mode;}
      public void reject(String m,String code){error=code;}public void resolve(JSObject value){result=value;}}`,
  'com/getcapacitor/JSObject.java': 'package com.getcapacitor; public class JSObject extends java.util.HashMap<String,Object> {}',
  'com/getcapacitor/PluginMethod.java': 'package com.getcapacitor; public @interface PluginMethod {}',
  'com/getcapacitor/annotation/CapacitorPlugin.java': 'package com.getcapacitor.annotation; public @interface CapacitorPlugin {String name();}',
  'com/spendwise/app/SpendWiseSecurityPlugin.java': 'package com.spendwise.app; public class SpendWiseSecurityPlugin {}',
  'com/spendwise/app/SpendWiseAcquisitionPlugin.java': 'package com.spendwise.app; public class SpendWiseAcquisitionPlugin {}',
  'com/spendwise/app/R.java': `package com.spendwise.app; public class R {
    public static class color {public static final int spendwise_launch_background=1,spendwise_system_bar=2;}}`,
};

const nativeDir = 'android/app/src/main/java/com/spendwise/app/';

test('saved themes survive Android 16 outer-context attachment, splash and relaunch without early service access', () => {
  const temp = mkdtempSync(join(tmpdir(), 'spendwise-native-theme-'));
  try {
    for (const [path, contents] of Object.entries(stubs)) {
      const file = join(temp, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, contents);
    }
    const harness = join(temp, 'com/spendwise/app/AppearanceHarness.java');
    writeFileSync(harness, `package com.spendwise.app;
      import android.content.*; import android.content.res.*; import android.os.*; import com.getcapacitor.*;
      public class AppearanceHarness {
        static void check(boolean b,String message){if(!b)throw new AssertionError(message);}
        static class TestActivity extends MainActivity {void start(){Context base=new Context();base.outer=this;attachBaseContext(base);onCreate(new Bundle());}}
        public static void main(String[] args) {
          for(int sdk:new int[]{36,30,31}) for(String saved:new String[]{"LIGHT","DARK","SYSTEM","corrupt"}) {
            Build.VERSION.SDK_INT=sdk; Context.values.clear();Context.values.put("mode",saved);
            for(int os:new int[]{16,32}) {
              Resources.SYSTEM.config.uiMode=os;
              BridgeActivity.events.clear();androidx.appcompat.app.AppCompatDelegate.mode=-99;
              android.app.UiModeManager.INSTANCE.mode=-99;Context.lastServiceContext=null;
              TestActivity a=new TestActivity();a.start();
              int expected=saved.equals("DARK")?2:saved.equals("LIGHT")?1:-1;
              if(sdk==30) {
                check(BridgeActivity.events.get(0).equals("attach:"+expected),"saved mode must precede AppCompat attach");
                check(BridgeActivity.events.get(1).equals("splash:"+expected),"saved mode must precede splash");
              }
              if(sdk>=31)check(android.app.UiModeManager.INSTANCE.mode==(expected==-1?0:expected),"persisted app mode including SYSTEM reset");
              if(sdk>=31) {
                String splash="splash-modern:"+(expected==-1?0:expected);
                check(BridgeActivity.events.contains(splash),"modern saved mode applied before splash");
                check(BridgeActivity.events.indexOf(splash)<BridgeActivity.events.indexOf("create"),"splash precedes Capacitor initialization");
              }
              check(BridgeActivity.events.contains("SpendWiseAppearancePlugin"),"appearance bridge must be registered");
              boolean dark=saved.equals("DARK")||(!saved.equals("LIGHT")&&os==32);
              check(a.window.background==(dark?0xff05080c:0xfff8fafc),"native background follows resolved saved preference");
              check(a.window.lightStatus==!dark&&a.window.lightNavigation==!dark,"system icons match selected appearance");
              check(a.window.flags==8192,"appearance must preserve secure flags");
              check(a.getBridge().web.background==a.window.background,"WebView background follows native appearance");
              if(sdk>=31)check(Context.lastServiceContext==Context.APPLICATION,"UiModeManager must use initialized application context");
              Configuration changed=new Configuration();changed.uiMode=os==16?32:16;
              a.onConfigurationChanged(changed);
              check(a.window.background==(dark?0xff05080c:0xfff8fafc),"configuration change preserves selected appearance");
              TestActivity relaunched=new TestActivity();relaunched.start();
              check(relaunched.window.background==a.window.background,"second startup retains saved theme without attachment failure");
            }
          }
          TestActivity a=new TestActivity();a.start();SpendWiseAppearancePlugin plugin=new SpendWiseAppearancePlugin();plugin.activity=a;
          for(String mode:new String[]{"LIGHT","DARK","SYSTEM"}) {
            PluginCall call=new PluginCall(mode);plugin.setThemeMode(call);
            check(call.error==null&&mode.equals(call.result.get("mode")),"valid mode acknowledged");
            check(Context.values.size()==1&&mode.equals(Context.values.get("mode")),"only validated mode mirrored");
          }
          for(String mode:new String[]{null,"dark","","expense"}) {
            PluginCall call=new PluginCall(mode);plugin.setThemeMode(call);
            check("INVALID_THEME_MODE".equals(call.error),"invalid mode rejected");
            check("SYSTEM".equals(Context.values.get("mode")),"invalid mode cannot overwrite mirror");
          }
          Context.durable=false;PluginCall failed=new PluginCall("DARK");plugin.setThemeMode(failed);
          check("APPEARANCE_SAVE_FAILED".equals(failed.error),"failed durable write cannot report success");
          Context.durable=true;Resources.SYSTEM.config.uiMode=32;
          a.onConfigurationChanged(Resources.SYSTEM.config);
          check(a.window.background==0xff05080c&&!a.window.lightStatus,"SYSTEM reacts to OS change");
          System.out.println("native appearance boundary cases passed");
        }
      }
    `);
    const sources = Object.keys(stubs).map((path) => join(temp, path));
    sources.push(`${nativeDir}SpendWiseAppearancePlugin.java`, `${nativeDir}SpendWiseAppearance.java`);
    const compile = spawnSync('javac', ['-d', temp, ...sources, `${nativeDir}MainActivity.java`, harness], { encoding: 'utf8' });
    assert.equal(compile.status, 0, `Java boundary harness must compile: ${compile.stderr}`);
    const run = spawnSync('java', ['-cp', temp, 'com.spendwise.app.AppearanceHarness'], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /native appearance boundary cases passed/);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

test('appearance adapter sends only validated appearance and skips browser platforms', async () => {
  const { AndroidAppearanceAdapter } = await import('../src/platform/android/AndroidAppearanceAdapter');
  const sent: unknown[] = [];
  const bridge = { setThemeMode: async (options: { mode: string }) => {sent.push(options);return options;} };
  const browser = new AndroidAppearanceAdapter(bridge, () => false);
  assert.equal(await browser.setThemeMode('DARK'), false);
  assert.deepEqual(sent, []);
  const android = new AndroidAppearanceAdapter(bridge, () => true);
  assert.equal(await android.setThemeMode('LIGHT'), true);
  assert.equal(await android.setThemeMode('SYSTEM'), true);
  assert.equal(await android.setThemeMode('dark' as never), false);
  assert.deepEqual(sent, [{ mode: 'LIGHT' }, { mode: 'SYSTEM' }]);
});

test('appearance adapter reports failed native persistence without breaking later changes', async () => {
  const { AndroidAppearanceAdapter } = await import('../src/platform/android/AndroidAppearanceAdapter');
  let fail = true;
  const adapter = new AndroidAppearanceAdapter({ setThemeMode: async (options: { mode: string }) => {
    if (fail) throw new Error('native mirror unavailable');
    return options;
  } }, () => true);
  assert.equal(await adapter.setThemeMode('DARK'), false);
  fail = false;
  assert.equal(await adapter.setThemeMode('LIGHT'), true);
});

test('appearance adapter serializes changes so a slow earlier mode cannot overwrite the final choice', async () => {
  const { AndroidAppearanceAdapter } = await import('../src/platform/android/AndroidAppearanceAdapter');
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {release = resolve;});
  const sent: string[] = [];
  const adapter = new AndroidAppearanceAdapter({ setThemeMode: async (options: { mode: string }) => {
    if (options.mode === 'DARK') await barrier;
    sent.push(options.mode); return options;
  } }, () => true);
  const first = adapter.setThemeMode('DARK');
  const second = adapter.setThemeMode('LIGHT');
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(sent, []);
  release();
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.deepEqual(sent, ['DARK', 'LIGHT']);
});

test('theme hook mirrors mount, explicit changes and restored backups while SYSTEM responds to OS changes', async () => {
  // A minimal React dispatcher replaces the renderer; the production hook runs
  // unchanged. Effects retain dependency/cleanup behavior across these renders.
  const states: unknown[] = [];
  const effects: {deps: unknown[]; cleanup?: () => void}[] = [];
  let stateIndex = 0; let effectIndex = 0;
  const mirrored: string[] = [];
  let saved = 'LIGHT'; let dark = false; let listener: (() => void) | undefined;
  const media = { matches: true, addEventListener: (_: string, cb: () => void) => {listener = cb;},
    removeEventListener: () => {listener = undefined;} };
  const exports: Record<string, unknown> = {};
  const source = ts.transpileModule(readFileSync('src/app/hooks/useThemeLanguage.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(source, {
    exports,
    document: {documentElement: {classList: {toggle: (_: string, value: boolean) => {dark = value;}}, setAttribute: () => {}}},
    window: {matchMedia: () => media},
    require: (id: string) => {
      if (id === 'react') return {
        useState: (initial: unknown) => {
          const index = stateIndex++;
          if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
          return [states[index], (next: unknown) => {states[index] = next;}];
        },
        useCallback: (callback: unknown) => callback,
        useEffect: (effect: () => (() => void) | undefined, deps: unknown[]) => {
          const index = effectIndex++; const prior = effects[index];
          if (!prior || deps.some((dep, offset) => dep !== prior.deps[offset])) {
            prior?.cleanup?.();effects[index] = {deps, cleanup: effect()};
          }
        },
      };
      if (id.endsWith('/PreferencesRepository')) return {preferencesRepository: {
        getThemeMode: () => saved, setThemeMode: (mode: string) => {saved = mode;},
        getLanguage: () => 'en', setLanguage: () => {},
      }};
      if (id.endsWith('/AnalysisCacheService')) return {analysisCacheService: {clear: () => {}}};
      if (id.endsWith('/AndroidAppearanceAdapter')) return {androidAppearanceAdapter: {
        setThemeMode: async (mode: string) => {mirrored.push(mode);return true;},
      }};
      throw new Error(`Unexpected hook dependency ${id}`);
    },
  });
  const render = () => {
    stateIndex = 0;effectIndex = 0;
    return (exports.useThemeLanguage as () => {setThemeMode(mode: string): void;refreshFromStorage(): void})();
  };
  let hook = render();
  assert.equal(dark, false, 'saved LIGHT must override dark OS');
  assert.deepEqual(mirrored, ['LIGHT'], 'mount must seed the native mirror');
  hook.setThemeMode('DARK');hook = render();
  assert.equal(dark, true);assert.equal(mirrored.at(-1), 'DARK');
  saved = 'SYSTEM';hook.refreshFromStorage();hook = render();
  assert.equal(mirrored.at(-1), 'SYSTEM', 'backup restore must update native appearance');
  assert.equal(dark, true);
  media.matches = false;listener?.();
  assert.equal(dark, false, 'SYSTEM must follow a subsequent OS change');
  saved = 'LIGHT';hook.refreshFromStorage();render();
  assert.equal(dark, false);assert.equal(mirrored.at(-1), 'LIGHT');
});
