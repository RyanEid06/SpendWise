package com.spendwise.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import android.content.Context;
import android.net.Uri;
import android.os.Environment;
import android.os.ParcelFileDescriptor;
import android.system.Os;

import androidx.core.content.FileProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.Test;
import org.junit.runner.RunWith;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

@RunWith(AndroidJUnit4.class)
public class FileProviderBoundaryTest {
    private static final String AUTHORITY_SUFFIX = ".fileprovider";

    private Context context() {
        return InstrumentationRegistry.getInstrumentation().getTargetContext();
    }

    private Uri uriFor(File file) {
        return FileProvider.getUriForFile(context(), context().getPackageName() + AUTHORITY_SUFFIX, file);
    }

    private void assertDenied(File file) {
        try {
            uriFor(file);
            fail("FileProvider unexpectedly exposed " + file);
        } catch (IllegalArgumentException expected) {
            // The canonical file is outside the configured app-owned roots.
        }
    }

    private File write(File file) throws Exception {
        File parent = file.getParentFile();
        if (parent != null && !parent.exists()) assertTrue(parent.mkdirs() || parent.isDirectory());
        try (FileOutputStream output = new FileOutputStream(file)) {
            output.write("synthetic provider fixture".getBytes(StandardCharsets.UTF_8));
        }
        return file;
    }

    private void delete(File file) {
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) for (File child : children) delete(child);
        }
        // Do not follow symbolic links during test cleanup.
        file.delete();
    }

    @Test
    public void shareCacheAndCameraPicturesProduceFileProviderUris() throws Exception {
        Context app = context();
        File export = write(new File(new File(app.getCacheDir(), "shared"), "boundary-report.json"));
        File camera = write(new File(new File(app.getExternalFilesDir(Environment.DIRECTORY_PICTURES), "provider-boundary"), "camera.jpg"));
        try {
            Uri exportUri = uriFor(export);
            Uri cameraUri = uriFor(camera);
            assertEquals("content", exportUri.getScheme());
            assertEquals("content", cameraUri.getScheme());
            assertEquals("application/json", context().getContentResolver().getType(exportUri));
            assertEquals("image/jpeg", context().getContentResolver().getType(cameraUri));
            try (ParcelFileDescriptor ignored = context().getContentResolver().openFileDescriptor(exportUri, "r")) {
                assertNotNull(ignored);
            }
            try (ParcelFileDescriptor ignored = context().getContentResolver().openFileDescriptor(cameraUri, "r")) {
                assertNotNull(ignored);
            }
        } finally {
            delete(export);
            delete(camera);
        }
    }

    @Test
    public void privateDatabaseSharedRootCacheSiblingsAndTraversalAreDenied() throws Exception {
        Context app = context();
        File privateFile = write(new File(app.getFilesDir(), "provider-boundary-private.txt"));
        File database = write(app.getDatabasePath("provider-boundary-private.db"));
        File cacheSibling = write(new File(app.getCacheDir(), "provider-boundary-private.txt"));
        File webViewCache = write(new File(new File(app.getCacheDir(), "webview"), "provider-boundary-private.txt"));
        File draftCache = write(new File(new File(app.getCacheDir(), "expense-draft-cache"), "provider-boundary-private.txt"));
        File externalRoot = new File(Environment.getExternalStorageDirectory(), "SpendWise-provider-boundary.txt");
        File externalFilesSibling = write(new File(app.getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS), "provider-boundary-private.txt"));
        File traversal = new File(new File(app.getCacheDir(), "shared"), "../provider-boundary-private.txt");
        try {
            assertDenied(privateFile);
            assertDenied(database);
            assertDenied(cacheSibling);
            assertDenied(webViewCache);
            assertDenied(draftCache);
            assertDenied(externalRoot);
            assertDenied(externalFilesSibling);
            assertDenied(traversal);
        } finally {
            delete(privateFile);
            delete(database);
            delete(cacheSibling);
            delete(webViewCache);
            delete(draftCache);
            delete(externalFilesSibling);
        }
    }

    @Test
    public void symlinkInsideShareDirectoryCannotExposeItsSiblingTarget() throws Exception {
        Context app = context();
        File privateTarget = write(new File(app.getCacheDir(), "provider-boundary-symlink-target.txt"));
        File shareDirectory = new File(app.getCacheDir(), "shared");
        assertTrue(shareDirectory.mkdirs() || shareDirectory.isDirectory());
        File link = new File(shareDirectory, "provider-boundary-link.txt");
        try {
            Os.symlink(privateTarget.getAbsolutePath(), link.getAbsolutePath());
            assertDenied(link);
        } finally {
            link.delete();
            delete(privateTarget);
        }
    }
}
